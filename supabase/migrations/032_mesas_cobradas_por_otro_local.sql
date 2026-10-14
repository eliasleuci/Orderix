-- ============================================================
-- 032 — Mesas que cobra el local con el que se comparten
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- El salón se comparte con otro local y a veces es ése el que le cobra al
-- cliente. Hasta ahora la mesa se cerraba con un medio de pago cualquiera:
-- figuraba como cobrada en la caja de ese día sin que la plata hubiera entrado,
-- y nadie se acordaba de reclamarla.
--
-- Ahora la mesa se cierra con payment_method = 'OTHER_LOCAL' (pendiente) y,
-- cuando el otro local paga, el pedido pasa al medio real y guarda en
-- collected_at cuándo entró la plata. La caja la cuenta ese día, no el del
-- pedido; las ventas siguen contándose el día del pedido.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.collected_at IS
  'Cuándo se cobró un pedido que cobró el otro local (OTHER_LOCAL). NULL: se cobró al momento.';

-- La lista de pendientes de cobro se consulta siempre por sucursal.
CREATE INDEX IF NOT EXISTS idx_orders_cobra_otro_local
  ON orders (branch_id, created_at DESC) WHERE payment_method = 'OTHER_LOCAL';

-- El arqueo cuenta lo cobrado en el turno por la fecha de cobro.
CREATE INDEX IF NOT EXISTS idx_orders_cobrados_despues
  ON orders (branch_id, collected_at) WHERE collected_at IS NOT NULL;

-- Nombre del local con el que se comparten las mesas, para mostrarlo al cobrar.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS shared_tables_partner TEXT
  CHECK (shared_tables_partner IS NULL OR length(trim(shared_tables_partner)) BETWEEN 1 AND 60);

-- Los usuarios de la sucursal no pueden escribir en branches (sólo el super
-- admin). Esto deja cambiar ese único dato, y sólo al dueño de la sucursal.
CREATE OR REPLACE FUNCTION set_shared_tables_partner(p_nombre TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Sólo el administrador puede cambiar el local de las mesas compartidas';
  END IF;

  UPDATE branches
     SET shared_tables_partner = NULLIF(trim(p_nombre), '')
   WHERE id = get_my_branch_id();
END;
$function$;

REVOKE ALL ON FUNCTION set_shared_tables_partner(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_shared_tables_partner(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Columnas nuevas. Esperado: 2.
SELECT count(*) AS columnas_nuevas
  FROM information_schema.columns
 WHERE (table_name = 'orders'   AND column_name = 'collected_at')
    OR (table_name = 'branches' AND column_name = 'shared_tables_partner');

-- Función nueva. Esperado: 1.
SELECT count(*) AS funcion_nueva FROM pg_proc WHERE proname = 'set_shared_tables_partner';
