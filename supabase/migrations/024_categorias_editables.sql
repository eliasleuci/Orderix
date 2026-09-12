-- ============================================================
-- 024 — Categorías con imagen y orden, editables desde el Catálogo
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- La tienda online que el dueño ya conoce (Pedix) muestra las categorías como
-- tarjetas grandes con foto; acá "categories" sólo tenía nombre. Se le suma
-- imagen, orden y una pausa (para ocultarla sin borrarla).
--
-- De paso, un agujero que ya existía y que esta migración deja expuesto si no
-- se corrige: "categories" nunca tuvo una política de escritura en ninguna
-- migración anterior, sólo de lectura. Con RLS activado y sin política de
-- INSERT/UPDATE/DELETE, esas operaciones quedan bloqueadas para todo el mundo
-- salvo el rol postgres. Crear una categoría desde el Catálogo probablemente
-- ya fallaba antes de este cambio; ahora que se agrega un panel entero para
-- editarlas, hace falta que la escritura funcione.
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
-- Pausar y no borrar: una categoría con productos no se puede eliminar sin
-- antes mover o borrar esos productos (products.category_id es NoAction), y
-- pausar alcanza para sacarla de la carta pública sin tocar nada de eso.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_categories_tenant_orden
  ON categories (tenant_id, display_order);


-- ------------------------------------------------------------
-- La escritura que nunca existió
-- ------------------------------------------------------------
-- Sólo el dueño da de alta, edita o borra categorías. El cajero las ve (ya
-- tenía lectura) pero no las toca.
DROP POLICY IF EXISTS "Categorias escritura admin" ON categories;
CREATE POLICY "Categorias escritura admin" ON categories
  FOR ALL USING (
    (tenant_id = get_my_tenant_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  )
  WITH CHECK (
    (tenant_id = get_my_tenant_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Columnas nuevas. Esperado: 3.
SELECT count(*) AS columnas_nuevas
  FROM information_schema.columns
 WHERE table_name = 'categories' AND column_name IN ('image_url','display_order','is_active');

-- La política de escritura existe. Esperado: 1.
SELECT count(*) AS politica_escritura
  FROM pg_policies
 WHERE tablename = 'categories' AND policyname = 'Categorias escritura admin';
