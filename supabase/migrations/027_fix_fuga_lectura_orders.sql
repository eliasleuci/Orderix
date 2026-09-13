-- ============================================================
-- 027 — Cerrar la fuga de lectura entre locales en orders / order_items / tables
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- EL PROBLEMA
-- Las políticas de SELECT de estas tres tablas terminaban en un
-- "OR auth.uid() IS NOT NULL": cualquier usuario logueado -el cajero de otro
-- local- podía leer los pedidos, montos, nombres y direcciones de clientes de
-- TODOS los locales, entrando directo por la API pública de Supabase sin pasar
-- por el backend. La propia 022 ya lo había marcado como deuda pendiente.
--
-- POR QUÉ ESTABA ASÍ, Y POR QUÉ NO SE ARREGLA FILTRANDO POR SUCURSAL
-- Al entrar, el usuario ELIGE la sucursal en un selector, y puede elegir
-- cualquiera de su local, no sólo la que tiene asignada en el perfil. Filtrar la
-- lectura por "branch_id = get_my_branch_id()" (la sucursal del perfil) dejaría
-- sin ver los pedidos a quien está mirando otra sucursal del mismo local. Por
-- eso en su momento se abrió a "cualquiera logueado", que tapó el problema pero
-- lo dejó demasiado abierto.
--
-- LA SOLUCIÓN: filtrar por LOCAL (tenant), no por sucursal.
-- El usuario ve todos los pedidos de SU local (cualquiera de sus sucursales),
-- pero ninguno de otro local. Multi-sucursal sigue andando; la fuga se cierra.
--
-- POR QUÉ ES SEGURO (no rompe nada que hoy funcione)
--   * La escritura de la cocina (EMPEZAR/LISTO) ya está restringida a
--     branch_id = get_my_branch_id() y NO se toca acá. Este cambio es sólo de
--     lectura, y la lectura nueva (mismo local) es MÁS amplia que lo que la
--     escritura ya exige: no puede frenar ninguna operación que hoy ande.
--   * Toda lectura legítima de hoy (un usuario mirando pedidos de su propio
--     local, de cualquiera de sus sucursales) sigue pasando, porque el tenant
--     coincide. Lo único que deja de poder es leer los de OTRO local.
--   * La cocina sin sesión nunca leyó pedidos igual: sin auth.uid() tampoco
--     pasaba el "OR auth.uid() IS NOT NULL" viejo. No hay regresión ahí.
-- ============================================================

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Orders Read Branch" ON orders;
CREATE POLICY "Orders Read Branch" ON orders
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- ------------------------------------------------------------
-- order_items — se acota por el pedido padre visible, para que nunca pueda
-- diverger de lo que orders deja ver (y no depende de que cada fila tenga bien
-- seteado su propio tenant_id).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Order Items Read" ON order_items;
CREATE POLICY "Order Items Read" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE tenant_id = get_my_tenant_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- ------------------------------------------------------------
-- tables — mismo criterio. La escritura ("Tables Write Policy") ya va por
-- sucursal y no se toca.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Tables Read Policy" ON tables;
CREATE POLICY "Tables Read Policy" ON tables
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Ninguna de las tres políticas de lectura debe seguir teniendo el
-- "auth.uid() IS NOT NULL". Esperado: 0 filas.
SELECT tablename, policyname, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('orders','order_items','tables')
   AND cmd = 'SELECT'
   AND qual ILIKE '%auth.uid() is not null%';

-- Las tres políticas quedaron acotadas por tenant. Esperado: 3 filas, cada una
-- con get_my_tenant_id() en su definición.
SELECT tablename, policyname
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('orders','order_items','tables')
   AND cmd = 'SELECT'
   AND qual ILIKE '%get_my_tenant_id()%'
 ORDER BY tablename;
