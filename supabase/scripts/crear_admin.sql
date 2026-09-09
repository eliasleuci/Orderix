-- ============================================================
-- Orderix - Alta de usuarios ADMIN
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================
-- Crea (o reutiliza) el usuario en auth.users, su identity, el
-- tenant, la sucursal y el profile con role = 'ADMIN'.
-- Todo en una sola corrida, sin pasar por la UI de Auth.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- FUNCIÓN REUTILIZABLE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_usuario_admin(
  p_email         TEXT,
  p_password      TEXT,
  p_tenant_name   TEXT,
  p_tenant_slug   TEXT,
  p_branch_name   TEXT DEFAULT 'Sucursal Central',
  p_branch_location TEXT DEFAULT 'Ubicación pendiente',
  p_role          TEXT DEFAULT 'ADMIN'
)
RETURNS TABLE (user_id UUID, tenant_id UUID, branch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $fn$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
  v_branch_id UUID;
  v_email     TEXT := lower(trim(p_email));
BEGIN
  IF p_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'CASHIER', 'KITCHEN') THEN
    RAISE EXCEPTION 'Rol inválido: %. Usar SUPER_ADMIN, ADMIN, CASHIER o KITCHEN.', p_role;
  END IF;

  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
  END IF;

  -- 1) Usuario de Auth (si ya existe, se reutiliza y se actualiza la clave)
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
      extensions.crypt(p_password, extensions.gen_salt('bf')),
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

    RAISE NOTICE 'Usuario de Auth creado: % (%)', v_email, v_user_id;
  ELSE
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at         = NOW()
     WHERE id = v_user_id;

    RAISE NOTICE 'Usuario ya existía, contraseña actualizada: % (%)', v_email, v_user_id;
  END IF;

  -- 2) Tenant (por slug, que es UNIQUE)
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug, email)
    VALUES (p_tenant_name, p_tenant_slug, v_email)
    RETURNING id INTO v_tenant_id;
    RAISE NOTICE 'Tenant creado: % (%)', p_tenant_name, v_tenant_id;
  END IF;

  -- 3) Sucursal
  SELECT id INTO v_branch_id
    FROM branches
   WHERE tenant_id = v_tenant_id AND name = p_branch_name
   LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO branches (tenant_id, name, location, email)
    VALUES (v_tenant_id, p_branch_name, p_branch_location, v_email)
    RETURNING id INTO v_branch_id;
    RAISE NOTICE 'Sucursal creada: % (%)', p_branch_name, v_branch_id;
  END IF;

  -- 4) Profile (lo que define el rol y el filtro multi-tenant)
  INSERT INTO profiles (id, tenant_id, branch_id, email, role)
  VALUES (v_user_id, v_tenant_id, v_branch_id, v_email, p_role)
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        branch_id = EXCLUDED.branch_id,
        email     = EXCLUDED.email,
        role      = EXCLUDED.role;

  RAISE NOTICE 'Listo. Login: % / rol %', v_email, p_role;

  RETURN QUERY SELECT v_user_id, v_tenant_id, v_branch_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_usuario_admin(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- USO
-- ============================================================

-- A) Cliente nuevo: crea tenant + sucursal + admin
SELECT * FROM public.crear_usuario_admin(
  p_email         => 'admin@nuevocliente.com',
  p_password      => 'CambiarEsta.2026',
  p_tenant_name   => 'Nombre del Cliente',
  p_tenant_slug   => 'nombre-cliente',
  p_branch_name   => 'Sucursal Central',
  p_branch_location => 'Av. Siempre Viva 742'
);

-- B) Usuario extra dentro de un tenant que YA existe
--    (mismo slug => reutiliza el tenant, no lo duplica)
-- SELECT * FROM public.crear_usuario_admin(
--   p_email       => 'cajero@nuevocliente.com',
--   p_password    => 'CambiarEsta.2026',
--   p_tenant_name => 'Nombre del Cliente',
--   p_tenant_slug => 'nombre-cliente',
--   p_branch_name => 'Sucursal Central',
--   p_role        => 'CASHIER'
-- );

-- C) Promover a ADMIN un usuario que ya tiene profile
-- UPDATE profiles SET role = 'ADMIN' WHERE email = 'alguien@cliente.com';

-- D) Cambiar la contraseña de un usuario existente
-- UPDATE auth.users
--    SET encrypted_password = extensions.crypt('NuevaClave.2026', extensions.gen_salt('bf')),
--        updated_at = NOW()
--  WHERE email = 'admin@nuevocliente.com';

-- E) Verificar cómo quedó todo
-- SELECT p.email, p.role, t.name AS cliente, t.slug, b.name AS sucursal,
--        u.email_confirmed_at IS NOT NULL AS email_confirmado
--   FROM profiles p
--   JOIN tenants  t ON t.id = p.tenant_id
--   LEFT JOIN branches b ON b.id = p.branch_id
--   JOIN auth.users u ON u.id = p.id
--  ORDER BY t.name, p.role;
