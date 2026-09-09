-- ============================================================
-- Orderix - RECUPERAR ACCESO AL PANEL ADMIN
-- Caso: se borraron los usuarios, pero los datos del negocio
--       (productos, órdenes, stock) siguen en la base.
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================
-- IMPORTANTE: el admin nuevo debe apuntar al tenant QUE YA
-- EXISTE. Si creás un tenant nuevo, entrás a un sistema vacío
-- porque toda la app filtra por tenant_id.
-- ============================================================


-- ------------------------------------------------------------
-- PASO 1 - DIAGNÓSTICO (correr solo esto primero)
-- Mirá qué tenant tiene tus datos y copiá su id.
-- ------------------------------------------------------------
SELECT
  t.id            AS tenant_id,
  t.name          AS cliente,
  t.slug,
  t.is_active,
  (SELECT count(*) FROM branches  b WHERE b.tenant_id = t.id) AS sucursales,
  (SELECT count(*) FROM products  p WHERE p.tenant_id = t.id) AS productos,
  (SELECT count(*) FROM orders    o WHERE o.tenant_id = t.id) AS ordenes,
  (SELECT count(*) FROM profiles  pr WHERE pr.tenant_id = t.id) AS usuarios
FROM tenants t
ORDER BY productos DESC, ordenes DESC;

-- Sucursales disponibles (necesitás el branch_id para el admin)
SELECT b.id AS branch_id, b.name AS sucursal, b.tenant_id, t.name AS cliente
FROM branches b
JOIN tenants t ON t.id = b.tenant_id
ORDER BY t.name, b.name;

-- ¿Quedó algún usuario huérfano en Auth?
SELECT u.id, u.email, u.created_at, (p.id IS NOT NULL) AS tiene_profile
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at;


-- ------------------------------------------------------------
-- PASO 2 - CREAR EL ADMIN SOBRE LOS DATOS EXISTENTES
-- Elegí el tenant con más productos/órdenes del PASO 1.
-- Este bloque NO crea tenant ni sucursal nuevos.
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  -- ====== EDITÁ ESTAS 3 LÍNEAS ======
  v_email     TEXT := 'admin@orderix.com';
  v_password  TEXT := 'Orderix.2026!';
  v_tenant_id UUID := NULL;   -- NULL = usa automáticamente el tenant
                              -- con más datos. O pegá un id del PASO 1.
  -- ==================================

  v_user_id   UUID;
  v_branch_id UUID;
BEGIN
  v_email := lower(trim(v_email));

  -- Elegir tenant: el indicado, o el que más datos tenga
  IF v_tenant_id IS NULL THEN
    SELECT t.id INTO v_tenant_id
    FROM tenants t
    ORDER BY (SELECT count(*) FROM products p WHERE p.tenant_id = t.id) DESC,
             (SELECT count(*) FROM orders   o WHERE o.tenant_id = t.id) DESC,
             t.created_at ASC
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No hay ningún tenant en la base. Usá crear_admin.sql para dar de alta un cliente desde cero.';
  END IF;

  -- Primera sucursal de ese tenant (o crearla si no quedó ninguna)
  SELECT id INTO v_branch_id
  FROM branches WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO branches (tenant_id, name, location)
    VALUES (v_tenant_id, 'Sucursal Central', 'Ubicación pendiente')
    RETURNING id INTO v_branch_id;
    RAISE NOTICE 'No había sucursales, se creó una nueva: %', v_branch_id;
  END IF;

  -- Usuario en auth.users (si ya existe, se le resetea la contraseña)
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
    RAISE NOTICE 'El usuario ya existía en Auth, se reseteó la contraseña.';
  END IF;

  -- Profile ADMIN apuntando al tenant/sucursal que YA tienen los datos
  INSERT INTO profiles (id, tenant_id, branch_id, email, role)
  VALUES (v_user_id, v_tenant_id, v_branch_id, v_email, 'ADMIN')
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        branch_id = EXCLUDED.branch_id,
        email     = EXCLUDED.email,
        role      = 'ADMIN';

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'LISTO. Entrá con:';
  RAISE NOTICE '  Email:      %', v_email;
  RAISE NOTICE '  Contraseña: %', v_password;
  RAISE NOTICE '  tenant_id:  %', v_tenant_id;
  RAISE NOTICE '  branch_id:  %', v_branch_id;
  RAISE NOTICE '=========================================';
END $$;


-- ------------------------------------------------------------
-- PASO 3 - VERIFICAR
-- ------------------------------------------------------------
SELECT p.email, p.role, t.name AS cliente, b.name AS sucursal,
       (u.email_confirmed_at IS NOT NULL) AS email_confirmado,
       (SELECT count(*) FROM products pr WHERE pr.tenant_id = p.tenant_id) AS productos_visibles
FROM profiles p
JOIN auth.users u ON u.id = p.id
JOIN tenants  t   ON t.id = p.tenant_id
LEFT JOIN branches b ON b.id = p.branch_id
ORDER BY p.role;
