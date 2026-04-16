-- ==========================================
-- 🍔 PRIME BURGERS: DATABASE SETUP SCRIPT
-- ==========================================
-- Instrucciones: Ejecuta todo este script en el SQL Editor de Supabase.

-- 1. EXTENSIONES BÁSICAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. LIMPIEZA PREVIA (Opcional, permite re-ejecutar el script)
-- ==========================================
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- ==========================================
-- 3. CREACIÓN DE TABLAS
-- ==========================================

-- Clientes / Empresas (Tenants)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING_PAYMENT')) DEFAULT 'ACTIVE',
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sucursales
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  email TEXT, -- Email específico de la sucursal
  phone TEXT, -- Teléfono específico de la sucursal
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING_PAYMENT')) DEFAULT 'ACTIVE',
  subscription_expires_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfiles de Usuario (Vinculado a auth.users de Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'CASHIER', 'KITCHEN')) DEFAULT 'CASHIER',
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías (Opcional pero recomendable para organizar)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE
);

-- Productos (Hamburguesas, Bebidas, etc.)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category_id UUID REFERENCES categories(id),
  image_url TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingredientes (Stock)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- ej: 'gr', 'unidad', 'ml'
  min_stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recetas (Para saber cuánto descontar por cada producto)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 3) NOT NULL, -- Cuánto consume del ingrediente
  UNIQUE(product_id, ingredient_id)
);

-- Pedidos (Órdenes)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number SERIAL,
  status TEXT CHECK (status IN ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED')) DEFAULT 'PENDING',
  total DECIMAL(10, 2) NOT NULL,
  payment_method TEXT,
  customer_name TEXT,
  customer_address TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Cajero que lo tomó
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de la Orden
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  modifiers JSONB, -- Para Extra Carne, Sin Cebolla, etc.
  notes TEXT
);

-- ==========================================
-- 3. FUNCIÓN RPC PARA TRANSACCIÓN SEGURA (LÓGICA CORE)
-- ==========================================
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

-- ==========================================
-- 4. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ==========================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Crear una función auxiliar para obtener de forma segura el tenant_id del usuario logueado
CREATE OR REPLACE FUNCTION get_my_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Crear una función auxiliar para obtener de forma segura el branch_id del usuario logueado
CREATE OR REPLACE FUNCTION get_my_branch_id() RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Reglas (Omitiendo restricciones severas de update/delete para facilitar Testing)
-- Reglas (Omitiendo restricciones severas de update/delete para facilitar Testing)
CREATE POLICY "Super Admin Full Access Tenants" ON tenants FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Super Admin Full Access Branches" ON branches FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Super Admin Full Access Profiles" ON profiles FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Ver mi sucursal" ON branches FOR SELECT USING (id = get_my_branch_id());
CREATE POLICY "Ver perfiles sucursal" ON profiles FOR SELECT USING (branch_id = get_my_branch_id());
CREATE POLICY "Public Categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Ver productos sucursal" ON products FOR SELECT USING (branch_id = get_my_branch_id() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');
CREATE POLICY "Ver ingredientes sucursal" ON ingredients FOR SELECT USING (branch_id = get_my_branch_id() OR branch_id IS NULL OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');
CREATE POLICY "Ver recetas" ON recipes FOR SELECT USING (true);

-- Órdenes e Ítems (Sólo los de tu sucursal o Super Admin)
CREATE POLICY "Orders Branch Isolation" ON orders FOR ALL USING (
  branch_id = get_my_branch_id() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
CREATE POLICY "Order Items Branch Isolation" ON order_items FOR ALL USING (
  order_id IN (SELECT id FROM orders WHERE branch_id = get_my_branch_id()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- ==========================================
-- 5. HABILITAR REALTIME (PARA EL KITCHEN DISPLAY)
-- ==========================================
BEGIN;
  -- Asegurarse de que el publication base existe
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
-- Agregar las tablas a escuchar
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ==========================================
-- 6. SEED DATA (DATOS INICIALES)
-- ==========================================

-- A) Crear sucursal de prueba
INSERT INTO branches (id, name, location) 
VALUES ('b1111111-1111-1111-1111-111111111111', 'Prime Burgers - Centro', 'La Calera, Córdoba, Argentina 🇦🇷')
ON CONFLICT (id) DO NOTHING;

-- B) Crear Cajero de Prueba (Ojo, auth.users NO SE CREA POR SQL DIRECTO, debe pasarse por signup en frontend, 
-- pero simulamos un profile genérico si se necesita, aunque fallado el FK si no existe en auth.users. 
-- *Recomendación*: Crea un usuario desde el Dashboard de Auth y luego aségnale el branch_id en profiles manualmente).

-- C) Categorías
INSERT INTO categories (id, name) VALUES 
('c1111111-1111-1111-1111-111111111111', 'Hamburguesas'),
('c2222222-2222-2222-2222-222222222222', 'Guarniciones')
ON CONFLICT (id) DO NOTHING;

-- D) Ingredientes
-- Pan, Carne (medallones), Queso (fetas), Papas (gr)
INSERT INTO ingredients (id, name, stock, unit, min_stock, branch_id) VALUES 
('a1111111-1111-1111-1111-111111111111', 'Pan de Hamburguesa', 100, 'unidad', 20, 'b1111111-1111-1111-1111-111111111111'),
('a2222222-2222-2222-2222-222222222222', 'Medallón de Carne 180g', 150, 'unidad', 30, 'b1111111-1111-1111-1111-111111111111'),
('a3333333-3333-3333-3333-333333333333', 'Feta de Cheddar', 300, 'unidad', 50, 'b1111111-1111-1111-1111-111111111111'),
('a4444444-4444-4444-4444-444444444444', 'Papas Bastón Congeladas', 50000, 'gr', 5000, 'b1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- E) Productos
INSERT INTO products (id, name, price, category_id, branch_id) VALUES 
('e1111111-1111-1111-1111-111111111111', 'Hamburguesa Simple', 5000, 'c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111'),
('e2222222-2222-2222-2222-222222222222', 'Hamburguesa Doble', 7500, 'c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111'),
('e3333333-3333-3333-3333-333333333333', 'Papas Fritas Chicas', 2000, 'c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- F) Recetas
-- Simple: 1 pan, 1 carne, 2 fetas cheddar
INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES 
('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1),
('e1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 1),
('e1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 2);

-- Doble: 1 pan, 2 carne, 4 fetas cheddar
INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES 
('e2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 1),
('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 2),
('e2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 4);

-- Papas Chicas: 250gr de papas
INSERT INTO recipes (product_id, ingredient_id, quantity) VALUES 
('e3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 250);
