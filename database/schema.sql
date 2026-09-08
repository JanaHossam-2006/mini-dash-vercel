-- ============================================================================
-- Mini Dash Supabase Database Schema
-- All calculated columns are managed at database level
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core columns
    order_code TEXT UNIQUE NOT NULL,
    employee_name TEXT,
    customer_phone TEXT,
    representative_number TEXT,
    product_name TEXT,
    price NUMERIC(10, 2),
    store TEXT,
    order_note TEXT,
    call_attempts INTEGER DEFAULT 0,
    client_status TEXT,
    more_than_5_attempts BOOLEAN DEFAULT FALSE,
    client_note TEXT,
    shipment_status TEXT,
    representative_note TEXT,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    return_status TEXT,
    admin_alert TEXT,
    admin_note TEXT,
    shipping_company TEXT,
    
    -- Calculated columns (managed by database)
    delivered TEXT DEFAULT 'no',
    filter TEXT DEFAULT 'no',
    delivery_filter TEXT DEFAULT NULL,
    dashboard_filter TEXT DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE: deliveries
-- ============================================================================
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    store TEXT,
    delivery_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint on order_code to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_order_code_unique 
ON deliveries(order_code);

-- ============================================================================
-- TABLE: test_orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT UNIQUE NOT NULL,
    customer_phone TEXT,
    store TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_employee_name ON orders(employee_name);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store);
CREATE INDEX IF NOT EXISTS idx_orders_client_status ON orders(client_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_status ON orders(shipment_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_company ON orders(shipping_company);
CREATE INDEX IF NOT EXISTS idx_orders_dashboard_filter ON orders(dashboard_filter);
CREATE INDEX IF NOT EXISTS idx_orders_filter ON orders(filter);
CREATE INDEX IF NOT EXISTS idx_orders_delivered ON orders(delivered);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_phone ON deliveries(customer_phone);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);

-- Test orders index
CREATE INDEX IF NOT EXISTS idx_test_orders_order_code ON test_orders(order_code);

-- ============================================================================
-- FUNCTION: recalculate_calculated_columns()
-- Recalculates delivered, delivery_filter, filter, and dashboard_filter for ALL orders
-- Call this after uploading new data or clicking "إعادة الحساب"
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_calculated_columns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    -- ── Step 1: Update delivered & delivery_filter ──────────────────────────
    UPDATE orders o
    SET
        delivered = CASE
            -- 1) تسليم مباشر بنفس كود الطلب
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.order_code = o.order_code
            ) THEN 'yes'

            -- 2) تسليم بكود آخر غير موجود إطلاقاً في جدول الطلبات (orders)
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.customer_phone = o.customer_phone
                  AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
                  AND NOT EXISTS (
                      SELECT 1 FROM orders o2 WHERE o2.order_code = d.order_code
                  )
            ) AND o.id = (
                SELECT o3.id FROM orders o3
                WHERE o3.customer_phone = o.customer_phone
                  AND (o3.store = o.store OR o3.store IS NULL OR o.store IS NULL)
                  AND NOT EXISTS (
                      SELECT 1 FROM deliveries d2 WHERE d2.order_code = o3.order_code
                  )
                ORDER BY o3.order_date DESC, o3.id ASC
                LIMIT 1
            ) THEN 'yes'

            ELSE 'no'
        END,

        delivery_filter = CASE
            -- 1) تسليم مباشر بنفس كود الطلب
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.order_code = o.order_code
            ) THEN 'تم التسليم بنفس الكود'

            -- 2) تسليم بكود آخر غير موجود في جدول الطلبات
            WHEN EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.customer_phone = o.customer_phone
                  AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
                  AND NOT EXISTS (
                      SELECT 1 FROM orders o2 WHERE o2.order_code = d.order_code
                  )
            ) AND o.id = (
                SELECT o3.id FROM orders o3
                WHERE o3.customer_phone = o.customer_phone
                  AND (o3.store = o.store OR o3.store IS NULL OR o.store IS NULL)
                  AND NOT EXISTS (
                      SELECT 1 FROM deliveries d2 WHERE d2.order_code = o3.order_code
                  )
                ORDER BY o3.order_date DESC, o3.id ASC
                LIMIT 1
            ) THEN CONCAT(
                'استلم بكود آخر غير موجود - ',
                COALESCE((
                    SELECT d.order_code FROM deliveries d
                    WHERE d.customer_phone = o.customer_phone
                      AND (d.store = o.store OR d.store IS NULL OR o.store IS NULL)
                      AND NOT EXISTS (
                          SELECT 1 FROM orders o2 WHERE o2.order_code = d.order_code
                      )
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

-- ============================================================================
-- FUNCTION: recalculate_single_order()
-- Efficiently recalculate for a single order (called after insert/update)
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_single_order(p_order_id UUID)
RETURNS void AS $$
DECLARE
    rec orders;
    v_customer_phone TEXT;
    v_order_code TEXT;
    v_order_date TIMESTAMP WITH TIME ZONE;
    v_delivered BOOLEAN;
    v_delivery_filter TEXT;
    v_filter TEXT;
    v_dashboard_filter TEXT;
    v_has_own_delivery BOOLEAN;
    v_has_other_delivery_for_customer BOOLEAN;
    v_delivered_codes_for_customer TEXT[];
    v_newest_non_delivered_order_id UUID;
BEGIN
    -- Get the order
    SELECT * INTO rec FROM orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    v_customer_phone := rec.customer_phone;
    v_order_code := rec.order_code;
    v_order_date := rec.order_date;
    v_delivered := FALSE;
    v_delivery_filter := NULL;
    v_filter := 'no';
    v_dashboard_filter := NULL;
    
    -- Check if this specific order_code is delivered
    SELECT EXISTS (
        SELECT 1 FROM deliveries 
        WHERE order_code = v_order_code
    ) INTO v_has_own_delivery;
    
    IF v_has_own_delivery THEN
        v_delivered := TRUE;
        v_delivery_filter := 'تم التسليم بنفس الكود';
    END IF;
    
    -- Check if customer has deliveries with OTHER order codes
    SELECT EXISTS (
        SELECT 1 FROM deliveries d
        WHERE d.customer_phone = v_customer_phone
        AND d.order_code != v_order_code
    ) INTO v_has_other_delivery_for_customer;
    
    IF v_has_own_delivery THEN
        NULL;
    ELSIF v_has_other_delivery_for_customer THEN
        SELECT ARRAY(
            SELECT DISTINCT d.order_code
            FROM deliveries d
            WHERE d.customer_phone = v_customer_phone
            AND d.order_code != v_order_code
        ) INTO v_delivered_codes_for_customer;
        
        -- Find newest non-delivered order for this customer
        SELECT o.id INTO v_newest_non_delivered_order_id
        FROM orders o
        WHERE o.customer_phone = v_customer_phone
        AND o.order_code != ALL(v_delivered_codes_for_customer)
        ORDER BY o.order_date DESC
        LIMIT 1;
        
        IF rec.id = v_newest_non_delivered_order_id THEN
            v_delivery_filter := 'استلم بكود آخر';
        ELSE
            v_delivery_filter := 'Ignore';
        END IF;
    END IF;
    
    -- Check test_orders
    SELECT EXISTS (
        SELECT 1 FROM test_orders WHERE order_code = v_order_code
    ) INTO v_filter;
    IF v_filter THEN
        v_filter := 'yes';
    ELSE
        v_filter := 'no';
    END IF;
    
    -- Dashboard filter
    IF v_delivery_filter = 'Ignore' THEN
        v_dashboard_filter := 'Ignore';
    ELSE
        v_dashboard_filter := NULL;
    END IF;
    
    -- Update
    UPDATE orders SET
        delivered = v_delivered,
        delivery_filter = v_delivery_filter,
        filter = v_filter,
        dashboard_filter = v_dashboard_filter,
        updated_at = NOW()
    WHERE id = p_order_id;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECURITY: Enable RLS (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- ORDERS: Public read access (only visible rows)
-- Dashboard only shows rows where dashboard_filter != 'Ignore'
CREATE POLICY "Public can read visible orders" ON orders
    FOR SELECT
    USING (dashboard_filter IS NULL OR dashboard_filter != 'Ignore');

-- ORDERS: Admin-only update (for recalculation trigger)
CREATE POLICY "Admins can update orders" ON orders
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- DELIVERIES: Public read (for dashboard calculations)
CREATE POLICY "Public can read deliveries" ON deliveries
    FOR SELECT
    USING (true);

-- DELIVERIES: Admin-only insert/update/delete
CREATE POLICY "Admins can manage deliveries" ON deliveries
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- TEST_ORDERS: Public read (for dashboard filter)
CREATE POLICY "Public can read test_orders" ON test_orders
    FOR SELECT
    USING (true);

-- TEST_ORDERS: Admin-only insert/update/delete
CREATE POLICY "Admins can manage test_orders" ON test_orders
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- EDGE FUNCTIONS (create these in Supabase Dashboard > Edge Functions)
-- ============================================================================

/*
-- Function: recalculate-dashboard
CREATE OR REPLACE FUNCTION recalculate_dashboard()
RETURNS void AS $$
BEGIN
    PERFORM recalculate_calculated_columns();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

/*
-- Function: upload-deliveries-csv
CREATE OR REPLACE FUNCTION upload_deliveries_csv(deliveries_data JSON)
RETURNS JSON AS $$
DECLARE
    v_inserted_count INTEGER := 0;
    v_updated_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    rec JSON;
BEGIN
    FOR rec IN SELECT * FROM json_array_elements(deliveries_data)
    LOOP
        BEGIN
            INSERT INTO deliveries (order_code, customer_phone, store, delivery_date)
            VALUES (
                rec->>'order_code',
                rec->>'customer_phone',
                rec->>'store',
                (rec->>'delivery_date')::TIMESTAMP WITH TIME ZONE
            )
            ON CONFLICT (order_code) DO UPDATE SET
                customer_phone = EXCLUDED.customer_phone,
                store = EXCLUDED.store,
                delivery_date = EXCLUDED.delivery_date,
                created_at = NOW();
            
            GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := array_append(v_errors, rec->>'order_code' || ': ' || SQLERRM);
        END;
    END LOOP;
    
    PERFORM recalculate_calculated_columns();
    
    RETURN json_build_object(
        'success', true,
        'inserted', v_inserted_count,
        'errors', v_errors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/