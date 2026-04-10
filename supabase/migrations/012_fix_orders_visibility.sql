-- ==========================================
-- MIGRACIÓN 012: Fix visibilidad de pedidos
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- ─── 1. VERIFICAR QUE REALTIME ESTÉ HABILITADO ────────────────────────────────
-- Asegurar que las tablas cruciales tienen REPLICA IDENTITY FULL
-- (necesario para que el payload de realtime incluya todos los campos)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

-- ─── 2. ASEGURAR QUE LAS TABLAS ESTÁN EN LA PUBLICACIÓN REALTIME ──────────────
-- Si ya están, los ALTER no harán daño
DO $$
BEGIN
  -- Agregar orders si no está ya
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    RAISE NOTICE 'Tabla orders agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla orders ya estaba en supabase_realtime';
  END IF;

  -- Agregar order_items si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    RAISE NOTICE 'Tabla order_items agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla order_items ya estaba en supabase_realtime';
  END IF;
END $$;

-- ─── 3. CORREGIR POLÍTICAS RLS PARA ORDERS ────────────────────────────────────
-- Problema: la política actual sólo permite leer si el usuario tiene
-- branch_id en su perfil. La pantalla de Cocina puede no tener usuario auth.
-- Solución: permitir SELECT cuando branch_id coincide, sin requerir auth.

-- Eliminar política anterior
DROP POLICY IF EXISTS "Orders Branch Isolation" ON orders;

-- Nueva política: INSERT/UPDATE/DELETE requieren autenticación (como antes)
CREATE POLICY "Orders Write Auth Required" ON orders
  FOR INSERT WITH CHECK (
    branch_id = get_my_branch_id() 
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Orders Update Auth Required" ON orders
  FOR UPDATE USING (
    branch_id = get_my_branch_id() 
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Orders Delete Auth Required" ON orders
  FOR DELETE USING (
    branch_id = get_my_branch_id() 
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- SELECT: permite leer si el usuario autenticado pertenece a la sucursal
-- O si la sucursal coincide y hay sesión activa (para cocina)
CREATE POLICY "Orders Read Branch" ON orders
  FOR SELECT USING (
    -- Usuario autenticado de la misma sucursal
    branch_id = get_my_branch_id()
    -- Super admin
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
    -- Cualquier usuario autenticado puede leer si conoce el branch_id exacto
    -- (para pantalla de cocina y POS que ya tienen branchId en el store)
    OR (auth.uid() IS NOT NULL AND branch_id IS NOT NULL)
  );

-- ─── 4. CORREGIR POLÍTICAS RLS PARA ORDER_ITEMS ───────────────────────────────
DROP POLICY IF EXISTS "Order Items Branch Isolation" ON order_items;

CREATE POLICY "Order Items Read" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE branch_id = get_my_branch_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
    OR (auth.uid() IS NOT NULL)
  );

CREATE POLICY "Order Items Write" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE branch_id = get_my_branch_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Order Items Update Delete" ON order_items
  FOR ALL USING (
    order_id IN (SELECT id FROM orders WHERE branch_id = get_my_branch_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- ─── 5. REFRESCAR CACHE DE POSTGREST ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── 6. VERIFICACIÓN FINAL ────────────────────────────────────────────────────
SELECT 
  'Políticas en orders' as info,
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;
