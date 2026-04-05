-- ==========================================
-- 🍔 PRIME BURGERS: MIGRATION 002
-- Agrega tabla de movimientos de stock y categorías de ingredientes
-- ==========================================
-- Ejecuta este SQL en tu base de datos después de setup.sql

-- 1. Crear enum para tipos de movimiento
DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM ('ADD', 'REMOVE', 'ADJUST', 'INITIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla de categorías de ingredientes
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agregar columna category_id a ingredients
DO $$ BEGIN
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES ingredient_categories(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 4. Crear índice para category_id
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category_id);

-- 5. Tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type movement_type NOT NULL DEFAULT 'ADJUST',
    quantity DECIMAL(10, 3) NOT NULL,
    stock_before DECIMAL(10, 3) NOT NULL,
    stock_after DECIMAL(10, 3) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);

-- 7. Políticas RLS para nuevas tablas
ALTER TABLE ingredient_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver categorias" ON ingredient_categories FOR SELECT USING (true);
CREATE POLICY "Insertar categorias (admin)" ON ingredient_categories FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "Ver movimientos sucursal" ON stock_movements FOR SELECT USING (
    ingredient_id IN (SELECT id FROM ingredients WHERE branch_id = get_my_branch_id())
);

CREATE POLICY "Insertar movimientos (admin)" ON stock_movements FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- 8. Agregar columnas faltantes a orders si no existen
DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_number SERIAL UNIQUE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'TAKEAWAY';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 9. Agregar columnas faltantes a ingredients si no existen
DO $$ BEGIN
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 10. Agregar columnas faltantes a products si no existen
DO $$ BEGIN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 11. Seed data: Categorías de ingredientes
INSERT INTO ingredient_categories (name) VALUES 
    ('CARNES'),
    ('LACTEOS'),
    ('PANADERIA'),
    ('VERDURAS'),
    ('BEBIDAS'),
    ('OTROS')
ON CONFLICT (name) DO NOTHING;

-- 12. Actualizar función RPC para registrar movimientos de stock
CREATE OR REPLACE FUNCTION create_order_secure(
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
  v_ticket_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_ticket_number FROM orders WHERE branch_id = p_branch_id;

  INSERT INTO orders (branch_id, user_id, customer_name, customer_address, total, status, payment_method, ticket_number, order_type, table_id)
  VALUES (p_branch_id, p_user_id, p_customer_name, p_customer_address, p_total, 'PENDING', p_payment_method, v_ticket_number, p_order_type, p_table_id)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, price DECIMAL)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);

    FOR v_recipe IN SELECT ingredient_id, quantity FROM recipes WHERE product_id = v_item.product_id
    LOOP
      SELECT stock INTO v_stock_actual FROM ingredients WHERE id = v_recipe.ingredient_id FOR UPDATE;

      IF v_stock_actual < (v_recipe.quantity * v_item.quantity) THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', v_item.product_id;
      END IF;

      UPDATE ingredients 
      SET stock = stock - (v_recipe.quantity * v_item.quantity)
      WHERE id = v_recipe.ingredient_id
      RETURNING stock INTO v_stock_actual;

      INSERT INTO stock_movements (ingredient_id, user_id, type, quantity, stock_before, stock_after, reason)
      VALUES (
        v_recipe.ingredient_id,
        p_user_id,
        'REMOVE',
        -(v_recipe.quantity * v_item.quantity),
        v_stock_actual + (v_recipe.quantity * v_item.quantity),
        v_stock_actual,
        'Venta - Orden #' || v_ticket_number
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('status', 'success', 'order_id', v_order_id, 'ticket_number', v_ticket_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 13. FUNCIONES RPC PARA PANEL DE STOCK
-- ==========================================

-- Listar ingredientes por sucursal
CREATE OR REPLACE FUNCTION get_ingredients()
RETURNS TABLE (
  id UUID,
  name TEXT,
  unit TEXT,
  stock DECIMAL,
  min_stock DECIMAL,
  category_id UUID,
  category_name TEXT,
  is_active BOOLEAN,
  deleted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id, i.name, i.unit, i.stock, i.min_stock,
    i.category_id, COALESCE(ic.name, '') as category_name,
    i.is_active, i.deleted_at
  FROM ingredients i
  LEFT JOIN ingredient_categories ic ON i.category_id = ic.id
  WHERE i.branch_id = get_my_branch_id()
  ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar stock de un ingrediente
CREATE OR REPLACE FUNCTION update_ingredient_stock(
  p_ingredient_id UUID,
  p_new_stock DECIMAL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_old_stock DECIMAL;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT stock INTO v_old_stock FROM ingredients WHERE id = p_ingredient_id FOR UPDATE;
  
  UPDATE ingredients SET stock = p_new_stock WHERE id = p_ingredient_id;
  
  INSERT INTO stock_movements (ingredient_id, user_id, type, quantity, stock_before, stock_after, reason)
  VALUES (p_ingredient_id, v_user_id, 'ADJUST', p_new_stock - v_old_stock, v_old_stock, p_new_stock, p_reason);
  
  RETURN jsonb_build_object('status', 'success', 'stock', p_new_stock);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear ingrediente
CREATE OR REPLACE FUNCTION create_ingredient(
  p_name TEXT,
  p_unit TEXT,
  p_stock DECIMAL DEFAULT 0,
  p_min_stock DECIMAL DEFAULT 0,
  p_category_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  INSERT INTO ingredients (name, unit, stock, min_stock, branch_id, category_id)
  VALUES (p_name, p_unit, p_stock, p_min_stock, get_my_branch_id(), p_category_id)
  RETURNING id INTO v_id;
  
  INSERT INTO stock_movements (ingredient_id, user_id, type, quantity, stock_before, stock_after, reason)
  VALUES (v_id, v_user_id, 'INITIAL', p_stock, 0, p_stock, 'Creación de ingrediente');
  
  RETURN jsonb_build_object('status', 'success', 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar ingrediente (soft delete)
CREATE OR REPLACE FUNCTION delete_ingredient(p_ingredient_id UUID) RETURNS JSONB AS $$
DECLARE
  v_stock DECIMAL;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT stock INTO v_stock FROM ingredients WHERE id = p_ingredient_id;
  
  UPDATE ingredients SET deleted_at = NOW() WHERE id = p_ingredient_id;
  
  INSERT INTO stock_movements (ingredient_id, user_id, type, quantity, stock_before, stock_after, reason)
  VALUES (p_ingredient_id, v_user_id, 'ADJUST', -v_stock, v_stock, 0, 'Ingrediente eliminado');
  
  RETURN jsonb_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Listar categorías de ingredientes
CREATE OR REPLACE FUNCTION get_ingredient_categories()
RETURNS TABLE (id UUID, name TEXT) AS $$
BEGIN
  RETURN QUERY SELECT id, name FROM ingredient_categories ORDER BY name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear categoría de ingrediente
CREATE OR REPLACE FUNCTION create_ingredient_category(p_name TEXT) RETURNS JSONB AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO ingredient_categories (name) VALUES (UPPER(TRIM(p_name)))
  RETURNING id INTO v_id;
  
  RETURN jsonb_build_object('status', 'success', 'id', v_id, 'name', UPPER(TRIM(p_name)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
