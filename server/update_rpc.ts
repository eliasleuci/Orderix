import { Pool } from 'pg';

const pool = new Pool({ 
  host: 'aws-0-us-west-2.pooler.supabase.com', 
  port: 6543, 
  user: 'postgres.gxfdzjhxhuaenavxpzkj', 
  password: 'Orderix42854674',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const DROP_SQL = `
-- Intentamos borrar todas las versiones posibles para evitar ambigüedad
DROP FUNCTION IF EXISTS create_order_secure(uuid, uuid, uuid, text, text, jsonb, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS create_order_secure(uuid, uuid, uuid, text, jsonb, numeric, text, text, uuid, text);
DROP FUNCTION IF EXISTS create_order_secure(uuid, uuid, uuid, text, jsonb, numeric, text);
`;

const CREATE_SQL = `
CREATE OR REPLACE FUNCTION create_order_secure(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_user_id UUID,
  p_customer_name TEXT,
  p_customer_address TEXT,
  p_items JSONB,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_order_type TEXT DEFAULT 'TAKEAWAY',
  p_table_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_item RECORD;
  v_recipe RECORD;
  v_stock_actual DECIMAL;
BEGIN
  -- 1. Crear el pedido
  INSERT INTO orders (tenant_id, branch_id, user_id, customer_name, customer_address, total, status, payment_method, order_type, table_id)
  VALUES (p_tenant_id, p_branch_id, p_user_id, p_customer_name, p_customer_address, p_total, 'PENDING', p_payment_method, p_order_type, p_table_id)
  RETURNING id INTO v_order_id;

  -- 2. Recorrer los ítems recibidos (JSONB a recordset)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, price DECIMAL, modifiers JSONB, notes TEXT)
  LOOP
    -- Insertar el ítem en la orden
    INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price, modifiers, notes)
    VALUES (p_tenant_id, v_order_id, v_item.product_id, v_item.quantity, v_item.price, v_item.modifiers, v_item.notes);

    -- 3. Descontar Stock basado en la Receta
    FOR v_recipe IN SELECT ingredient_id, quantity FROM recipes WHERE product_id = v_item.product_id
    LOOP
      SELECT stock INTO v_stock_actual FROM ingredients WHERE id = v_recipe.ingredient_id FOR UPDATE;
      
      IF v_stock_actual IS NOT NULL THEN
        UPDATE ingredients 
        SET stock = stock - (v_recipe.quantity * v_item.quantity)
        WHERE id = v_recipe.ingredient_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('status', 'success', 'order_id', v_order_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function main() {
  try {
    console.log('--- LIMPIANDO FUNCIONES ANTIGUAS ---');
    await pool.query(DROP_SQL);
    console.log('--- CREANDO NUEVA FUNCIÓN ÚNICA ---');
    await pool.query(CREATE_SQL);
    console.log('✅ Base de datos limpia y función actualizada con éxito.');
  } catch (err) {
    console.error('❌ Error crítico al actualizar base de datos:', err);
  } finally {
    await pool.end();
  }
}

main();
