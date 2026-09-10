-- ============================================================
-- 016 — Soporte para el panel SuperAdmin
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- Todo idempotente: se puede correr más de una vez sin romper nada.
--
-- NO usar prisma migrate: la base nunca fue baselineada y Prisma
-- la interpretaría como drift.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — Columnas y tablas nuevas (aditivo, sin riesgo)
-- ------------------------------------------------------------

-- Baja de sucursal reversible. Sin esta columna la única forma de
-- "dar de baja" una sucursal sería borrarla, y eso cascadea a sus
-- usuarios, productos, mesas y órdenes.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Datos de contacto propios de cada sucursal. setup.sql los declara pero la
-- base real no los tiene: se perdieron en alguna recreación de la tabla.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone TEXT;

-- Notas de facturación por cliente.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notes TEXT;

-- Nota: tenants NO tiene logo_url en la base real, aunque setup.sql lo declare.
-- Y tenants.tenant_id es una columna muerta que dejó la migración 007 al agregar
-- tenant_id a todas las tablas, incluida tenants. Está siempre en NULL.

-- Historial de pagos. El requisito es registrar QUIÉN pagó y hasta
-- cuándo, o sea un log auditable; tenants.subscription_expires_at
-- queda como el estado derivado del último pago.
CREATE TABLE IF NOT EXISTS tenant_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2),
  currency     TEXT DEFAULT 'ARS',
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE,
  period_end   DATE NOT NULL,
  method       TEXT,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant
  ON tenant_payments (tenant_id, paid_at DESC);

-- El panel entra por la API con el rol postgres (BYPASSRLS), así que
-- no necesita policies. Se habilita RLS igual para que la tabla no
-- quede accesible con la clave pública.
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- PARTE B — Unicidad por tenant  (revisar antes de correr)
-- ------------------------------------------------------------
-- categories.name e ingredient_categories.name son UNIQUE GLOBALES.
-- Con multi-tenant eso significa que el segundo cliente que cree
-- "Bebidas" recibe un error de constraint. Hay que acotarlo al tenant.
--
-- Verificar primero que no haya duplicados dentro de un mismo tenant:
--   SELECT tenant_id, name, count(*) FROM categories
--    GROUP BY 1,2 HAVING count(*) > 1;
--   SELECT tenant_id, name, count(*) FROM ingredient_categories
--    GROUP BY 1,2 HAVING count(*) > 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN
    ALTER TABLE categories DROP CONSTRAINT categories_name_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_tenant_name_key') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_tenant_name_key UNIQUE (tenant_id, name);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_categories_name_key') THEN
    ALTER TABLE ingredient_categories DROP CONSTRAINT ingredient_categories_name_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_categories_tenant_name_key') THEN
    ALTER TABLE ingredient_categories
      ADD CONSTRAINT ingredient_categories_tenant_name_key UNIQUE (tenant_id, name);
  END IF;
END $$;


-- ------------------------------------------------------------
-- PARTE C — Arreglar la recursión de RLS en profiles
-- ------------------------------------------------------------
-- Las policies "Super Admin Full Access *" hacen
--   (SELECT role FROM profiles WHERE id = auth.uid())
-- y la de profiles consulta profiles desde sí misma -> Postgres tira
-- 42P17 "infinite recursion detected in policy". Como ese subselect se
-- repite en las policies de casi todas las tablas, contamina a todas.
--
-- La solución es la misma que ya usa get_my_tenant_id(): una función
-- SECURITY DEFINER, que no dispara RLS al leer profiles.

CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Super Admin Full Access Tenants" ON tenants;
CREATE POLICY "Super Admin Full Access Tenants" ON tenants FOR ALL
  USING (get_my_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Super Admin Full Access Branches" ON branches;
CREATE POLICY "Super Admin Full Access Branches" ON branches FOR ALL
  USING (get_my_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Super Admin Full Access Profiles" ON profiles;
CREATE POLICY "Super Admin Full Access Profiles" ON profiles FOR ALL
  USING (get_my_role() = 'SUPER_ADMIN');

-- Mismo subselect recursivo en el resto de las tablas.
DROP POLICY IF EXISTS "Ver productos sucursal" ON products;
CREATE POLICY "Ver productos sucursal" ON products FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR get_my_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "Ver ingredientes sucursal" ON ingredients;
CREATE POLICY "Ver ingredientes sucursal" ON ingredients FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR get_my_role() = 'SUPER_ADMIN');


-- ------------------------------------------------------------
-- PARTE D — Verificaciones (read-only, revisar el resultado)
-- ------------------------------------------------------------

-- Todas las FK hacia tenants deben cascadear ('c'), o el borrado
-- definitivo de un cliente va a fallar por constraint.
SELECT conname, conrelid::regclass AS tabla,
       CASE confdeltype WHEN 'c' THEN 'CASCADE'
                        WHEN 'a' THEN '*** NO ACTION - CORREGIR ***'
                        WHEN 'n' THEN 'SET NULL'
                        ELSE confdeltype::text END AS on_delete
FROM pg_constraint
WHERE confrelid = 'tenants'::regclass AND contype = 'f'
ORDER BY tabla;

-- Perfiles sin cuenta en Auth (basura de borrados anteriores).
SELECT p.email, p.role, t.name AS cliente
FROM profiles p
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
ORDER BY p.role, p.email;
