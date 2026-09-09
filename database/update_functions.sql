-- ============================================================================
-- recalculate_calculated_columns()
-- Run this after uploading deliveries or orders
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_calculated_columns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    -- ── 1. Reset calculated columns ─────────────────────────────────────────
    UPDATE orders SET
        delivered = 'no',
        delivery_filter = 'no',
        dashboard_filter = 'no';

    -- ── 2. Step 1: Direct order_code + store match ─────────────────────────
    UPDATE orders o
    SET
        delivered = 'yes',
        delivery_filter = 'تم التسليم بنفس الكود'
    FROM deliveries d
    WHERE d.order_code = o.order_code
      AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL);

    -- ── 3. Step 2: Match un-delivered orders with external deliveries (1-to-1 per customer & store)
    WITH unmatched_orders AS (
        SELECT
            id,
            customer_phone,
            store,
            ROW_NUMBER() OVER (
                PARTITION BY customer_phone, store
                ORDER BY order_date ASC, id ASC
            ) AS order_idx
        FROM orders
        WHERE delivered = 'no'
    ),
    unmatched_deliveries AS (
        SELECT
            d.order_code AS deliv_code,
            d.customer_phone,
            d.store,
            ROW_NUMBER() OVER (
                PARTITION BY d.customer_phone, d.store
                ORDER BY d.delivery_date ASC, d.id ASC
            ) AS deliv_idx
        FROM deliveries d
        WHERE NOT EXISTS (
            SELECT 1 FROM orders o2 WHERE o2.order_code = d.order_code
        )
    ),
    matched_pairs AS (
        SELECT
            uo.id AS order_id,
            ud.deliv_code
        FROM unmatched_orders uo
        JOIN unmatched_deliveries ud
          ON uo.customer_phone = ud.customer_phone
         AND (uo.store = ud.store OR uo.store IS NULL OR ud.store IS NULL)
         AND uo.order_idx = ud.deliv_idx
    )
    UPDATE orders o
    SET
        delivered = 'yes',
        delivery_filter = CONCAT('استلم بكود آخر - ', mp.deliv_code)
    FROM matched_pairs mp
    WHERE o.id = mp.order_id;

    -- ── 4. Step 3: Set dashboard_filter ('Yes', 'No', 'Ignore') ────────────
    -- Yes = delivered ('yes')
    -- Ignore = non-delivered AND customer has a delivered order in this store OR duplicate non-delivered
    -- No = non-delivered AND first non-delivered order for a customer with 0 deliveries in this store
    WITH customer_store_stats AS (
        SELECT
            id,
            delivered,
            MAX(
                CASE WHEN delivered = 'yes' THEN 1 ELSE 0 END
            ) OVER (PARTITION BY customer_phone, store) AS customer_has_delivered,
            ROW_NUMBER() OVER (
                PARTITION BY customer_phone, store, delivered
                ORDER BY order_date ASC, id ASC
            ) AS order_rank_in_group
        FROM orders
    )
    UPDATE orders o
    SET dashboard_filter = CASE
        -- 1) أي طلب اتسلم بياخد Yes
        WHEN css.delivered = 'yes' THEN 'Yes'

        -- 2) طلب مش متسلم ولكن العميل ليه طلبات متسلمة في نفس المتجر بياخد Ignore
        WHEN css.customer_has_delivered = 1 THEN 'Ignore'

        -- 3) أول طلب غير متسلم لعميل معندوش أي تسليمات في المتجر بياخد No
        WHEN css.order_rank_in_group = 1 THEN 'No'

        -- 4) باقي الطلبات المكررة غير المتسلمة لنفس العميل بتاخد Ignore
        ELSE 'Ignore'
    END
    FROM customer_store_stats css
    WHERE o.id = css.id;

END;
$$;
