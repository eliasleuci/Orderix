-- ============================================================
-- 020 — Mozos: quién atiende cada mesa
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Una mesa abierta no dejaba registro de quién la estaba atendiendo. Con más
-- de un mozo en el salón, saber a quién corresponde cada mesa dependía de la
-- memoria de quien estuviera en la caja.
--
-- Mismo modelo que los repartidores del delivery: una lista por sucursal que
-- administra el dueño, y una asignación por mesa que se elige al abrirla.
-- ============================================================

CREATE TABLE IF NOT EXISTS waiters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiters_branch
  ON waiters (branch_id, is_active);

-- ON DELETE SET NULL: borrar un mozo no puede borrar la mesa que atendía.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tables_waiter
  ON tables (waiter_id) WHERE waiter_id IS NOT NULL;


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE waiters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mozos lectura sucursal" ON waiters;
CREATE POLICY "Mozos lectura sucursal" ON waiters
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- Dar de alta y de baja personal es del dueño. Asignar un mozo a una mesa no
-- pasa por acá: eso escribe en tables, que el cajero ya puede modificar.
DROP POLICY IF EXISTS "Mozos escritura admin" ON waiters;
CREATE POLICY "Mozos escritura admin" ON waiters
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM waiters) AS mozos,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'tables' AND column_name = 'waiter_id') AS columna_en_mesas;
