-- ============================================================
-- Orderix - CONSOLA SUPER_ADMIN (por SQL)
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================
-- NOTA: el rol SUPER_ADMIN existe en las políticas RLS, pero
-- todavía NO hay pantalla en la app para gestionarlo. Mientras
-- tanto, estas consultas hacen lo que haría ese panel:
-- clientes activos, facturación y alta/baja de usuarios.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ============================================================
-- 1) CREAR TU USUARIO SUPER_ADMIN
-- ============================================================
-- Ve TODOS los tenants (las policies le dan acceso total).
-- No queda atado a un cliente puntual.
DO $$
DECLARE
  -- ====== EDITÁ ESTAS 2 LÍNEAS ======
  v_email    TEXT := 'superadmin@orderix.com';
  v_password TEXT := 'CambiarEstaClave.2026!';
  -- ==================================
  v_user_id   UUID;
  v_tenant_id UUID;
BEGIN
  v_email := lower(trim(v_email));

  -- El schema exige tenant_id NOT NULL en profiles: usamos un
  -- tenant interno propio, para no ensuciar el de un cliente.
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'orderix-interno';
  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug, email)
    VALUES ('Orderix (interno)', 'orderix-interno', v_email)
    RETURNING id INTO v_tenant_id;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- GoTrue lee estas columnas como TEXT: si quedan NULL el login
      -- falla con "Database error querying schema".
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('email', v_email),
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_user_id;
  END IF;

  INSERT INTO profiles (id, tenant_id, branch_id, email, role)
  VALUES (v_user_id, v_tenant_id, NULL, v_email, 'SUPER_ADMIN')
  ON CONFLICT (id) DO UPDATE
    SET role = 'SUPER_ADMIN', tenant_id = EXCLUDED.tenant_id, email = EXCLUDED.email;

  RAISE NOTICE 'SUPER_ADMIN listo -> % / %', v_email, v_password;
END $$;


-- ============================================================
-- 2) CLIENTES ACTIVOS  (lo que mostraría la pantalla "Clientes")
-- ============================================================
SELECT
  t.name                          AS cliente,
  t.slug,
  t.email,
  t.phone,
  t.is_active                     AS activo,
  t.subscription_status           AS suscripcion,
  t.subscription_expires_at::date AS vence,
  (SELECT count(*) FROM branches b WHERE b.tenant_id = t.id) AS sucursales,
  (SELECT count(*) FROM profiles p WHERE p.tenant_id = t.id) AS usuarios,
  t.created_at::date              AS alta
FROM tenants t
ORDER BY t.is_active DESC, t.name;


-- ============================================================
-- 3) FACTURACIÓN / ESTADO DE PAGO
-- ============================================================
-- Vencidos o por vencer en los próximos 15 días
SELECT
  t.name AS cliente,
  t.subscription_status,
  t.subscription_expires_at::date AS vence,
  (t.subscription_expires_at::date - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN t.subscription_expires_at IS NULL              THEN 'SIN FECHA'
    WHEN t.subscription_expires_at < NOW()              THEN 'VENCIDO'
    WHEN t.subscription_expires_at < NOW() + '15 days'::interval THEN 'POR VENCER'
    ELSE 'AL DIA'
  END AS estado
FROM tenants t
ORDER BY t.subscription_expires_at NULLS FIRST;

-- Ventas por cliente en los últimos 30 días (base para facturar)
SELECT
  t.name                AS cliente,
  count(o.id)           AS ordenes_30d,
  COALESCE(sum(o.total), 0) AS facturado_30d
FROM tenants t
LEFT JOIN orders o
       ON o.tenant_id = t.id
      AND o.created_at >= NOW() - '30 days'::interval
GROUP BY t.id, t.name
ORDER BY facturado_30d DESC;

-- Registrar un pago / renovar un mes
-- UPDATE tenants
--    SET subscription_status     = 'ACTIVE',
--        subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, NOW()), NOW()) + '1 month'::interval,
--        updated_at = NOW()
--  WHERE slug = 'nombre-cliente';

-- Marcar como impago
-- UPDATE tenants SET subscription_status = 'PENDING_PAYMENT' WHERE slug = 'nombre-cliente';


-- ============================================================
-- 4) ALTA Y BAJA DE CLIENTES
-- ============================================================
-- Dar de baja (suspende el acceso sin borrar los datos)
-- UPDATE tenants SET is_active = false, subscription_status = 'EXPIRED' WHERE slug = 'nombre-cliente';

-- Reactivar
-- UPDATE tenants SET is_active = true, subscription_status = 'ACTIVE' WHERE slug = 'nombre-cliente';

-- Alta de un cliente nuevo con su admin: usar crear_admin.sql


-- ============================================================
-- 5) ALTA Y BAJA DE USUARIOS
-- ============================================================
-- Listado completo
SELECT
  p.email,
  p.role,
  t.name AS cliente,
  b.name AS sucursal,
  u.last_sign_in_at::date AS ultimo_ingreso,
  (u.email_confirmed_at IS NOT NULL) AS confirmado
FROM profiles p
JOIN auth.users u ON u.id = p.id
JOIN tenants   t  ON t.id = p.tenant_id
LEFT JOIN branches b ON b.id = p.branch_id
ORDER BY t.name, p.role, p.email;

-- Alta de usuario: usar crear_admin.sql (p_role => 'ADMIN' | 'CASHIER' | 'KITCHEN')

-- Cambiar el rol de alguien
-- UPDATE profiles SET role = 'CASHIER' WHERE email = 'alguien@cliente.com';

-- Baja definitiva (borra el profile en cascada por el FK)
-- DELETE FROM auth.users WHERE email = 'alguien@cliente.com';

-- Resetear contraseña
-- UPDATE auth.users
--    SET encrypted_password = extensions.crypt('NuevaClave.2026!', extensions.gen_salt('bf')),
--        updated_at = NOW()
--  WHERE email = 'alguien@cliente.com';
