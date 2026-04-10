-- ==========================================
-- MIGRACIÓN 014: Funciones para Dine-In (Cuentas Abiertas y Unir Mesas)
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. ADD PARENT_TABLE_ID TO TABLES
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tables' AND column_name = 'parent_table_id'
  ) THEN
    ALTER TABLE tables ADD COLUMN parent_table_id UUID REFERENCES tables(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. FUNCIÓN PARA CERRAR Y COBRAR UNA CUENTA COMPLETA
CREATE OR REPLACE FUNCTION close_table_bill(
    p_table_id UUID,
    p_payment_method TEXT
) RETURNS JSONB AS $$
DECLARE
    v_updated_orders INT;
BEGIN
    -- 1. Update all unpaid orders for this table (and its children) to PAID
    WITH updated AS (
        UPDATE orders 
        SET payment_method = p_payment_method
        WHERE (table_id = p_table_id OR table_id IN (SELECT id FROM tables WHERE parent_table_id = p_table_id))
          AND payment_method = 'UNPAID'
        RETURNING id
    )
    SELECT count(*) INTO v_updated_orders FROM updated;

    -- 2. Free the parent table
    UPDATE tables 
    SET status = 'FREE', 
        customer_name = NULL, 
        notes = NULL, 
        opened_at = NULL 
    WHERE id = p_table_id;

    -- 3. Free the children tables & unlink them
    UPDATE tables 
    SET status = 'FREE', 
        customer_name = NULL, 
        notes = NULL, 
        opened_at = NULL,
        parent_table_id = NULL
    WHERE parent_table_id = p_table_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'orders_closed', v_updated_orders
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECARGAR CACHE DEL ESQUEMA
NOTIFY pgrst, 'reload schema';
