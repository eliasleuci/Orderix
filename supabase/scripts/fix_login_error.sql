-- ============================================================
-- FIX: "Database error querying schema" al iniciar sesión
-- ============================================================
-- Causa: los usuarios creados por SQL quedan con NULL en las
-- columnas de token de auth.users. GoTrue las lee como TEXT y
-- falla al convertir NULL -> string, devolviendo ese error.
-- Solución: poner cadena vacía ('') en lugar de NULL.
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ============================================================

-- PASO 1: Reparar todos los usuarios afectados
DO $$
DECLARE
  v_col  TEXT;
  v_cols TEXT[] := ARRAY[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ];
  v_fixed INT;
BEGIN
  FOREACH v_col IN ARRAY v_cols LOOP
    -- Solo si la columna existe en esta versión de GoTrue
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = v_col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = %L WHERE %I IS NULL',
        v_col, '', v_col
      );
      GET DIAGNOSTICS v_fixed = ROW_COUNT;
      IF v_fixed > 0 THEN
        RAISE NOTICE 'Reparada columna % en % usuario(s)', v_col, v_fixed;
      END IF;
    END IF;
  END LOOP;

  -- Otros campos que GoTrue espera no nulos
  UPDATE auth.users SET
    aud                = COALESCE(NULLIF(aud, ''), 'authenticated'),
    role               = COALESCE(NULLIF(role, ''), 'authenticated'),
    raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{"provider":"email","providers":["email"]}'::jsonb),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
    instance_id        = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    created_at         = COALESCE(created_at, NOW()),
    updated_at         = COALESCE(updated_at, NOW());

  RAISE NOTICE 'Listo. Probá iniciar sesión de nuevo.';
END $$;


-- PASO 2: Verificar que quedó todo sano
SELECT
  u.email,
  p.role,
  (u.encrypted_password IS NOT NULL)  AS tiene_password,
  (u.email_confirmed_at IS NOT NULL)  AS confirmado,
  EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id) AS tiene_identity,
  (u.confirmation_token IS NOT NULL)  AS token_ok
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY p.role NULLS LAST, u.email;


-- PASO 3 (solo si el PASO 2 muestra tiene_identity = false)
-- Crea la identity faltante, sin la cual el login por password falla.
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', NOW(), NOW(), NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);
