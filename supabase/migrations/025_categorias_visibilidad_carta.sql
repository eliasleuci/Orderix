-- ============================================================
-- 025 — Una categoría puede ocultarse de la carta del salón sin
--        ocultarse de los pedidos online
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- "is_active" ya sirve para pausar una categoría en todos lados. Este agrega
-- un segundo interruptor, más angosto: una categoría puede seguir activa
-- (visible en /pedir, en el catálogo, en el POS) pero no mostrarse en la
-- carta física de la mesa (/carta), por ejemplo una categoría de promos
-- pensada sólo para el pedido online.
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_in_carta BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Columna nueva. Esperado: 1.
SELECT count(*) AS columna_nueva
  FROM information_schema.columns
 WHERE table_name = 'categories' AND column_name = 'show_in_carta';
