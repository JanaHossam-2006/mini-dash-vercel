-- ============================================================================
-- recalculate_calculated_columns()
-- Run this after uploading deliveries or test_orders
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_calculated_columns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    -- ── Step 1: delivered, delivery_filter, filter ────────────────────────
    UPDATE orders o
    SET
        delivered = CASE
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.order_code = o.order_code
                   OR d.customer_phone = o.customer_phone
            ) THEN 'yes'
            ELSE 'no'
        END,

        delivery_filter = CASE
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.order_code = o.order_code
            ) THEN 'تم التسليم بنفس الكود'

            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.customer_phone = o.customer_phone
                  AND d.order_code <> o.order_code
            ) THEN 'استلم بكود آخر غير موجود'

            ELSE 'no'
        END,

        filter = CASE
            WHEN EXISTS (
                SELECT 1 FROM test_orders t
                WHERE t.order_code = o.order_code
            ) THEN 'yes'
            ELSE 'no'
        END
    WHERE TRUE;

    -- ── Step 2: dashboard_filter ─────────────────────────────────────────
    WITH order_status AS (
        SELECT
            o.id,
            o.delivered,
            MAX(
                CASE WHEN o2.delivered = 'yes' THEN 1 ELSE 0 END
            ) OVER (PARTITION BY o.customer_phone) AS customer_has_delivered,
            ROW_NUMBER() OVER (
                PARTITION BY o.customer_phone
                ORDER BY o.order_date ASC, o.id ASC
            ) AS order_rank
        FROM orders o
        LEFT JOIN orders o2
            ON o.customer_phone = o2.customer_phone
    )
    UPDATE orders o
    SET dashboard_filter = CASE
        WHEN s.delivered = 'yes'         THEN 'Yes'
        WHEN s.customer_has_delivered = 1 THEN 'Ignore'
        WHEN s.order_rank = 1            THEN 'No'
        ELSE                                  'Ignore'
    END
    FROM order_status s
    WHERE o.id = s.id;

    UPDATE orders o
    SET dashboard_filter = CASE
        WHEN s.delivered = 'yes'          THEN 'Yes'
        WHEN s.customer_has_delivered = 1 THEN 'Ignore'
        WHEN s.order_rank = 1             THEN 'No'
        ELSE                                   'Ignore'
    END
    FROM order_status s
    WHERE o.id = s.id;

END;
$$;
