-- ============================================================================
-- recalculate_calculated_columns()
-- Run this after uploading deliveries or test_orders
-- Combines delivered/delivery_filter/filter update + dashboard_filter update
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_calculated_columns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    -- ── Step 1: Update delivered and delivery_filter (with store matching) ──
    UPDATE orders o
    SET
        delivered = CASE
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.order_code = o.order_code
                   OR (
                       d.customer_phone = o.customer_phone
                       AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
                   )
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
                  AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
            ) THEN CONCAT(
                'استلم بكود آخر غير موجود - ',
                COALESCE((
                    SELECT d.order_code FROM deliveries d
                    WHERE d.customer_phone = o.customer_phone
                      AND d.order_code <> o.order_code
                      AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
                    ORDER BY d.delivery_date DESC NULLS LAST
                    LIMIT 1
                ), '')
            )

            ELSE 'no'
        END;

    -- ── Step 2: Update dashboard_filter based on order rank and customer status (per store)
    WITH order_status AS (
        SELECT
            o.id,
            o.delivered,
            MAX(
                CASE WHEN o.delivered = 'yes' THEN 1 ELSE 0 END
            ) OVER (PARTITION BY o.customer_phone, o.store) AS customer_has_delivered,
            ROW_NUMBER() OVER (
                PARTITION BY o.customer_phone, o.store
                ORDER BY o.order_date ASC, o.id ASC
            ) AS order_rank
        FROM orders o
    )
    UPDATE orders o
    SET dashboard_filter = CASE
        -- 1) الطلب نفسه اتسلم
        WHEN s.delivered = 'yes'
        THEN 'Yes'

        -- 2) العميل استلم طلب آخر لنفس المتجر
        WHEN s.customer_has_delivered = 1
        THEN 'Ignore'

        -- 3) العميل لا يملك أي تسليمات في هذا المتجر: نظهر أول طلب فقط
        WHEN s.order_rank = 1
        THEN 'No'

        -- 4) باقي طلبات نفس العميل غير المسلمة نلغيها
        ELSE 'Ignore'
    END
    FROM order_status s
    WHERE o.id = s.id;

END;
$$;

