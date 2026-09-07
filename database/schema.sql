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
    delivered BOOLEAN DEFAULT FALSE,
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
-- Recalculates delivered, delivery_filter, filter for ALL orders
-- Call this after uploading new data
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_calculated_columns()
RETURNS void AS $$
DECLARE
    rec orders;
    v_delivered BOOLEAN;
    v_delivery_filter TEXT;
    v_filter TEXT;
    v_dashboard_filter TEXT;
    v_has_own_delivery BOOLEAN;
    v_has_other_delivery_for_customer BOOLEAN;
    v_delivered_codes_for_customer TEXT[];
    v_newest_non_delivered_order_id UUID;
    
    -- For cursor-based processing of customer deliveries
    c_customer_deliveries CURSOR FOR 
        SELECT DISTINCT d.customer_phone
        FROM deliveries d
        INNER JOIN orders o ON d.customer_phone = o.customer_phone
        WHERE o.order_code != d.order_code
        AND o.delivery_filter IS NULL;
    
    v_customer_phone TEXT;
    v_first_delivered_order_code TEXT;
BEGIN
    -- Process customers who received delivery with DIFFERENT order code
    OPEN c_customer_deliveries;
    LOOP
        FETCH c_customer_deliveries INTO v_customer_phone;
        EXIT WHEN NOT FOUND;
        
        -- Get first delivered order code for this customer
        SELECT d.order_code INTO v_first_delivered_order_code
        FROM deliveries d
        WHERE d.customer_phone = v_customer_phone
        AND NOT EXISTS (
            SELECT 1 FROM orders o
            WHERE o.order_code = d.order_code
        )
        ORDER BY d.delivery_date ASC
        LIMIT 1;
        
        -- Find newest non-delivered order for this customer
        SELECT o.id INTO v_newest_non_delivered_order_id
        FROM orders o
        WHERE o.customer_phone = v_customer_phone
        AND o.order_code != ALL(
            SELECT d.order_code FROM deliveries d WHERE d.customer_phone = v_customer_phone
        )
        ORDER BY o.order_date DESC
        LIMIT 1;
        
        -- Update all orders for this customer
        UPDATE orders SET
            delivery_filter = CASE 
                WHEN id = v_newest_non_delivered_order_id THEN 'استلم بكود آخر'
                ELSE 'Ignore'
            END,
            dashboard_filter = CASE 
                WHEN id = v_newest_non_delivered_order_id THEN NULL
                ELSE 'Ignore'
            END,
            updated_at = NOW()
        WHERE customer_phone = v_customer_phone
        AND order_code != ALL(
            SELECT d.order_code FROM deliveries d WHERE d.customer_phone = v_customer_phone
        );
    END LOOP;
    CLOSE c_customer_deliveries;
    
    -- Process all orders
    FOR rec IN 
        SELECT * FROM orders
        WHERE delivery_filter IS NULL OR delivery_filter = ''
        ORDER BY id
    LOOP
        v_delivered := FALSE;
        v_delivery_filter := NULL;
        v_filter := 'no';
        v_dashboard_filter := NULL;
        
        -- Check if this specific order_code is delivered
        SELECT EXISTS (
            SELECT 1 FROM deliveries 
            WHERE order_code = rec.order_code
        ) INTO v_has_own_delivery;
        
        IF v_has_own_delivery THEN
            v_delivered := TRUE;
            v_delivery_filter := 'تم التسليم بنفس الكود';
        ELSE
            -- Check if customer has deliveries with OTHER order codes
            SELECT EXISTS (
                SELECT 1 FROM deliveries d
                WHERE d.customer_phone = rec.customer_phone
                AND d.order_code != rec.order_code
            ) INTO v_has_other_delivery_for_customer;
            
            IF v_has_other_delivery_for_customer THEN
                v_delivery_filter := 'Ignore';
            END IF;
        END IF;
        
        -- Check if order is in test_orders
        SELECT EXISTS (
            SELECT 1 FROM test_orders
            WHERE order_code = rec.order_code
        ) INTO v_filter;
        
        IF v_filter THEN
            v_filter := 'yes';
        ELSE
            v_filter := 'no';
        END IF;
        
        -- Determine dashboard_filter
        IF v_delivery_filter = 'Ignore' THEN
            v_dashboard_filter := 'Ignore';
        ELSE
            v_dashboard_filter := NULL;
        END IF;
        
        -- UPDATE the order with calculated values
        UPDATE orders SET
            delivered = v_delivered,
            delivery_filter = v_delivery_filter,
            filter = v_filter,
            dashboard_filter = v_dashboard_filter,
            updated_at = NOW()
        WHERE id = rec.id;
        
    END LOOP;
    
END;
$$ LANGUAGE plpgsql;

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