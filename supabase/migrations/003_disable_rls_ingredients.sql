-- ==========================================
-- 🍔 PRIME BURGERS: MIGRATION 003
-- Deshabilita RLS en tablas de ingredientes para permitir operaciones CRUD
-- NO afecta otras tablas (orders, products, profiles, etc.)
-- ==========================================

-- 1. Deshabilitar RLS en ingredients (permite leer, crear, actualizar, eliminar)
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;

-- 2. Deshabilitar RLS en ingredient_categories
ALTER TABLE ingredient_categories DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que solo se afectan las tablas de ingredientes
-- Las siguientes tablas mantienen su RLS original:
-- - orders (para seguridad de ventas)
-- - order_items (integridad con orders)
-- - products (catálogo)
-- - profiles (datos de usuarios)
-- - tables (mesas)
-- - recipes (recetas de productos)

-- 4. Confirmación - debe devolver solo 2 tablas
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false 
AND tablename IN ('ingredients', 'ingredient_categories');
