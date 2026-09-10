-- ============================================================
-- Verificación final: ¿los 2 usuarios están sanos?
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================

SELECT
  u.email,
  CASE
    WHEN p.id IS NULL           THEN '❌ SIN PERFIL - no puede operar'
    WHEN p.tenant_id IS NULL    THEN '❌ SIN TENANT - entra a un sistema vacío'
    WHEN p.role = 'SUPER_ADMIN' THEN '✅ Panel de plataforma (/superadmin)'
    WHEN p.branch_id IS NULL    THEN '⚠️ ADMIN sin sucursal asignada'
    ELSE '✅ OK'
  END                                       AS estado,
  p.role,
  t.name                                    AS cliente,
  b.name                                    AS sucursal,
  (SELECT count(*) FROM products pr WHERE pr.tenant_id = p.tenant_id) AS productos_visibles,
  (SELECT count(*) FROM orders   o  WHERE o.tenant_id  = p.tenant_id) AS ordenes_visibles,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN tenants  t ON t.id = p.tenant_id
LEFT JOIN branches b ON b.id = p.branch_id
ORDER BY p.role NULLS FIRST;

-- Perfiles que quedaron sin cuenta de Auth (basura de los borrados)
SELECT p.email, p.role, 'PERFIL HUERFANO' AS estado
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
