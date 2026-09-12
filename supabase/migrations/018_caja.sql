-- ============================================================
-- 018 — Control de caja: apertura con monto inicial y cierre con arqueo
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Qué resuelve: hasta ahora el Financiero decía cuánto se vendió, pero no
-- había forma de saber si esa plata estaba realmente en el cajón. Un faltante
-- se descubría de memoria, sin fecha, sin monto y sin responsable.
--
-- Un turno de caja guarda con qué fondo se abrió, qué se contó al cerrar y la
-- diferencia contra lo esperado. Los montos se congelan al cerrar: si después
-- se anula un pedido, el arqueo de ese día no cambia. Es un registro contable,
-- no una vista calculada.
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  opened_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Fondo con el que arranca el turno (el cambio que queda en el cajón).
  opening_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Se completan recién al cerrar.
  counted_amount  NUMERIC(12,2),  -- lo que la persona contó a mano
  cash_sales      NUMERIC(12,2),  -- ventas en efectivo del turno
  expected_amount NUMERIC(12,2),  -- opening_amount + cash_sales
  difference      NUMERIC(12,2),  -- counted_amount - expected_amount

  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opening_notes   TEXT,
  closing_notes   TEXT,

  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ
);

-- Una sola caja abierta por sucursal, garantizado por la base y no por el
-- código: si dos cajeros abren turno al mismo tiempo, uno falla. Validarlo
-- sólo en la aplicación deja pasar el caso de las dos pestañas simultáneas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_una_abierta
  ON cash_sessions (branch_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_historial
  ON cash_sessions (branch_id, opened_at DESC);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Más estricta que el resto de las tablas: acá no va el "OR auth.uid() IS NOT
-- NULL" que usan otras políticas. Son datos de dinero, y un cajero de otra
-- sucursal no tiene por qué ver el arqueo ajeno.
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caja lectura sucursal" ON cash_sessions;
CREATE POLICY "Caja lectura sucursal" ON cash_sessions
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Caja escritura sucursal" ON cash_sessions;
CREATE POLICY "Caja escritura sucursal" ON cash_sessions
  FOR ALL USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM cash_sessions)                      AS turnos_registrados,
  (SELECT COUNT(*) FROM cash_sessions WHERE status='OPEN')  AS cajas_abiertas;
