-- ============================================================
-- Orderix - DIAGNÓSTICO Y LIMPIEZA DE USUARIOS
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================
-- Correr PASO 1 y LEER el resultado antes de tocar el PASO 3.
-- ============================================================


-- ------------------------------------------------------------
-- PASO 1 - FOTO COMPLETA (Auth + profiles, sin perder huérfanos)
-- ------------------------------------------------------------
-- FULL JOIN a propósito: muestra cuentas sin perfil Y perfiles
-- sin cuenta, que es donde están los problemas.
SELECT
  COALESCE(u.email, p.email)              AS email,
  CASE
    WHEN u.id IS NULL THEN 'PERFIL HUERFANO (sin cuenta Auth)'
    WHEN p.id IS NULL THEN 'CUENTA SIN PERFIL (no puede operar)'
    ELSE 'OK'
  END                                      AS estado,
  p.role,
  t.name                                   AS cliente,
  b.name                                   AS sucursal,
  p.tenant_id,
  u.created_at::date                       AS creado,
  u.last_sign_in_at                        AS ultimo_ingreso
FROM auth.users u
FULL JOIN profiles p ON p.id = u.id
LEFT JOIN tenants  t ON t.id = p.tenant_id
LEFT JOIN branches b ON b.id = p.branch_id
ORDER BY estado, email;

-- Tenants existentes (para ver si sobra el interno)
SELECT t.id, t.name, t.slug,
       (SELECT count(*) FROM products p WHERE p.tenant_id = t.id) AS productos,
       (SELECT count(*) FROM orders   o WHERE o.tenant_id = t.id) AS ordenes,
       (SELECT count(*) FROM profiles pr WHERE pr.tenant_id = t.id) AS usuarios
FROM tenants t ORDER BY productos DESC;


-- ------------------------------------------------------------
-- PASO 2 - REPARAR AL CLIENTE REAL
-- ------------------------------------------------------------
-- Si primeburgers3@gmail.com salió como 'CUENTA SIN PERFIL' o
-- con cliente NULL, esto le devuelve su perfil ADMIN sobre el
-- tenant que tiene los datos (el de más productos).
DO $$
DECLARE
  v_email     TEXT := 'primeburgers3@gmail.com';   -- <- tu cliente real
  v_user_id   UUID;
  v_tenant_id UUID;
  v_branch_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta % en Auth.', v_email;
  END IF;

  -- Tenant con datos reales (nunca el interno de Orderix)
  SELECT t.id INTO v_tenant_id
  FROM tenants t
  WHERE t.slug IS DISTINCT FROM 'orderix-interno'
  ORDER BY (SELECT count(*) FROM products p WHERE p.tenant_id = t.id) DESC,
           (SELECT count(*) FROM orders   o WHERE o.tenant_id = t.id) DESC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No hay ningún tenant de cliente.';
  END IF;

  SELECT id INTO v_branch_id FROM branches
   WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1;

  INSERT INTO profiles (id, tenant_id, branch_id, email, role)
  VALUES (v_user_id, v_tenant_id, v_branch_id, v_email, 'ADMIN')
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        branch_id = EXCLUDED.branch_id,
        role      = 'ADMIN';

  RAISE NOTICE 'Perfil ADMIN restaurado para % en tenant %', v_email, v_tenant_id;
END $$;


-- ------------------------------------------------------------
-- PASO 3 - BORRAR LOS USUARIOS DE PRUEBA
-- ------------------------------------------------------------
-- DESTRUCTIVO. Revisá el PASO 1 antes de descomentar.
-- Conserva adm@orderix.com (tu super admin) y el cliente real.
--
-- DELETE FROM auth.users
--  WHERE email IN ('superadmin@orderix.com', 'admin@gmail.com');
--
-- Los profiles se borran solos por el ON DELETE CASCADE del FK.

-- Perfiles huérfanos (sin cuenta en Auth), si el PASO 1 mostró alguno:
-- DELETE FROM profiles p
--  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);


-- ------------------------------------------------------------
-- PASO 4 - VERIFICAR CÓMO QUEDÓ
-- ------------------------------------------------------------
SELECT u.email, p.role, t.name AS cliente, b.name AS sucursal
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN tenants  t ON t.id = p.tenant_id
LEFT JOIN branches b ON b.id = p.branch_id
ORDER BY p.role, u.email;
