-- ============================================================
-- 023 — Extras por producto: personalizar el pedido web
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Los "extras" del sistema eran una lista de hamburguesas hardcodeada en el
-- navegador de cada caja (localStorage), sin precio real en la base, y sin
-- relación con ningún producto puntual. En el pedido web no había forma de
-- ofrecer nada de eso.
--
-- Decisión tomada con el dueño: cada producto tiene sus propios grupos de
-- extras, cargados desde cero (no una biblioteca compartida entre productos),
-- y por ahora esto sólo alimenta el pedido web. Ventas sigue con su sistema
-- actual sin tocar; el día que se unifiquen, esta base ya les sirve.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — Grupos de extras
-- ------------------------------------------------------------
-- Un producto puede tener varios grupos ("Agranda tu burger", "Agregale a tus
-- papas"), cada uno con sus propias opciones.
--
-- min_select / max_select en vez de un booleano "es de elegir una sola": con
-- dos números alcanza para radio (min 1, max 1), checkbox libre (min 0, max
-- NULL) y checkbox obligatorio con tope (min 1, max 3), sin necesitar tres
-- columnas distintas ni un enum.
CREATE TABLE IF NOT EXISTS modifier_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  min_select    INT  NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  -- NULL = sin techo (multi-selección libre). 1 = elegir una sola (como radio).
  max_select    INT  CHECK (max_select IS NULL OR max_select >= 1),
  display_order INT  NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (max_select IS NULL OR min_select <= max_select)
);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_producto
  ON modifier_groups (product_id, display_order) WHERE is_active;

CREATE TABLE IF NOT EXISTS modifier_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  price         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modifier_options_grupo
  ON modifier_options (group_id, display_order) WHERE is_active;


-- ------------------------------------------------------------
-- PARTE B — Lo que el cliente eligió, congelado en el pedido
-- ------------------------------------------------------------
-- Mismo formato {label, price} que ya usan order_items.modifiers (lo que
-- escribe Ventas): el pedido web termina generando un pedido real por el mismo
-- camino, y así el ticket y la cocina no necesitan un caso especial para
-- mostrar extras según el pedido haya entrado por caja o por la web.
--
-- Se congela el precio de cada extra al momento de pedir y NO se revalida en
-- confirmar_pedido_web como sí se hace con el precio del producto: es una
-- decisión deliberada para no sumarle más complejidad a una función que ya se
-- reescribió muchas veces. Si un extra cambia de precio después de que el
-- cliente lo pidió, ese pedido puntual queda con el precio viejo.
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS modifiers JSONB;


-- ------------------------------------------------------------
-- PARTE C — confirmar_pedido_web ahora suma los extras congelados
-- ------------------------------------------------------------
-- Antes 'modifiers' iba siempre en NULL y 'price' era sólo el precio del
-- producto. Ahora price = precio de HOY del producto + la suma de los extras
-- congelados, y modifiers pasa tal cual al pedido real.
--
-- El precio de los extras nunca entra en la comparación de "cambió el
-- precio": al sumarse por igual a ambos lados (precio_pedido y precio_hoy),
-- la resta se cancela sola y sólo queda expuesta una diferencia real en el
-- precio del PRODUCTO, que es lo único que esta función revalida.
CREATE OR REPLACE FUNCTION public.confirmar_pedido_web(
  p_web_order_id UUID,
  p_user_id UUID,
  p_aceptar_cambio_de_precio BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pedido    web_orders%ROWTYPE;
  v_items     JSONB;
  v_total_hoy NUMERIC := 0;
  v_cambios   JSONB := '[]'::jsonb;
  v_faltantes JSONB := '[]'::jsonb;
  v_res       JSONB;
  v_order_id  UUID;
BEGIN
  SELECT * INTO v_pedido FROM web_orders WHERE id = p_web_order_id FOR UPDATE;

  IF v_pedido.id IS NULL THEN
    RETURN jsonb_build_object('status','error','message','El pedido no existe');
  END IF;

  IF v_pedido.status <> 'PENDING' THEN
    RETURN jsonb_build_object(
      'status','error',
      'message','El pedido ya estaba en ' || v_pedido.status,
      'order_id', v_pedido.order_id
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'producto', i.product_name, 'web_order_item_id', i.id)), '[]'::jsonb)
    INTO v_faltantes
    FROM web_order_items i
    LEFT JOIN products p ON p.id = i.product_id
   WHERE i.web_order_id = v_pedido.id
     AND (p.id IS NULL
          OR p.is_active IS NOT TRUE
          OR p.branch_id IS DISTINCT FROM v_pedido.branch_id);

  IF v_faltantes <> '[]'::jsonb THEN
    RETURN jsonb_build_object('status','productos_no_disponibles','faltantes', v_faltantes);
  END IF;

  SELECT
      jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'quantity',   i.quantity,
        'price',      p.price + COALESCE(ms.suma, 0),
        'modifiers',  i.modifiers,
        'notes',      i.notes
      ) ORDER BY i.product_name),
      COALESCE(sum((p.price + COALESCE(ms.suma, 0)) * i.quantity), 0),
      COALESCE(jsonb_agg(jsonb_build_object(
        'producto',      i.product_name,
        'precio_pedido', i.unit_price,
        'precio_hoy',    p.price + COALESCE(ms.suma, 0)
      )) FILTER (WHERE (p.price + COALESCE(ms.suma, 0)) IS DISTINCT FROM i.unit_price), '[]'::jsonb)
    INTO v_items, v_total_hoy, v_cambios
    FROM web_order_items i
    JOIN products p ON p.id = i.product_id
    -- Suma de los extras que el cliente eligió, ya congelados en i.modifiers.
    LEFT JOIN LATERAL (
      SELECT sum((elem->>'price')::numeric) AS suma
        FROM jsonb_array_elements(COALESCE(i.modifiers, '[]'::jsonb)) elem
    ) ms ON true
   WHERE i.web_order_id = v_pedido.id;

  IF v_items IS NULL THEN
    RETURN jsonb_build_object('status','error','message','El pedido no tiene productos');
  END IF;

  IF v_cambios <> '[]'::jsonb AND NOT p_aceptar_cambio_de_precio THEN
    RETURN jsonb_build_object(
      'status','precio_cambiado',
      'cambios', v_cambios,
      'total_pedido', v_pedido.items_total,
      'total_hoy', v_total_hoy
    );
  END IF;

  v_res := public.create_order_secure(
    p_tenant_id        => v_pedido.tenant_id,
    p_branch_id        => v_pedido.branch_id,
    p_user_id          => p_user_id,
    p_customer_name    => v_pedido.customer_name,
    p_customer_address => v_pedido.customer_address,
    p_items            => v_items,
    p_total            => v_total_hoy,
    p_payment_method   => v_pedido.payment_method,
    p_order_type       => v_pedido.order_type,
    p_table_id         => NULL,
    p_delivery_fee     => v_pedido.delivery_fee,
    p_delivery_zone_id => v_pedido.delivery_zone_id,
    p_delivery_km      => NULL
  );

  IF v_res->>'status' <> 'success' THEN
    RETURN jsonb_build_object(
      'status','error',
      'message', COALESCE(v_res->>'message','No se pudo crear el pedido')
    );
  END IF;

  v_order_id := (v_res->>'order_id')::uuid;

  UPDATE orders
     SET customer_phone = v_pedido.customer_phone,
         notes = v_pedido.notes
   WHERE id = v_order_id;

  UPDATE web_orders
     SET status = 'CONFIRMED',
         order_id = v_order_id,
         confirmed_by = p_user_id,
         confirmed_at = now(),
         updated_at = now()
   WHERE id = v_pedido.id;

  RETURN jsonb_build_object(
    'status','success',
    'order_id', v_order_id,
    'total', v_total_hoy + v_pedido.delivery_fee,
    'cambios_de_precio', v_cambios,
    'advertencias', COALESCE(v_res->'advertencias','[]'::jsonb)
  );
END;
$function$;

-- El REVOKE/GRANT de esta función se pierde con cada CREATE OR REPLACE que
-- toque su firma completa? No: CREATE OR REPLACE conserva los permisos
-- mientras la firma (lista de parámetros) no cambie, y acá es idéntica a la
-- de la 022. Se vuelve a blindar igual, por las dudas: es gratis y es lo que
-- la 021 pidió hacer siempre que se toque una de estas funciones.
SELECT public.blindar_rpcs_de_pedidos();


-- ------------------------------------------------------------
-- PARTE D — RLS
-- ------------------------------------------------------------
-- Mismo criterio que las zonas de envío (019): lectura por sucursal para
-- cualquiera del local, escritura sólo para el dueño. El pedido web público no
-- lee estas tablas por Supabase: las sirve Express en /webshop/publico, así
-- que no hace falta ninguna política para anon.
ALTER TABLE modifier_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE modifier_groups, modifier_options FROM anon;

DROP POLICY IF EXISTS "Grupos de extras lectura sucursal" ON modifier_groups;
CREATE POLICY "Grupos de extras lectura sucursal" ON modifier_groups
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Grupos de extras escritura admin" ON modifier_groups;
CREATE POLICY "Grupos de extras escritura admin" ON modifier_groups
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Opciones de extras lectura sucursal" ON modifier_options;
CREATE POLICY "Opciones de extras lectura sucursal" ON modifier_options
  FOR SELECT USING (
    group_id IN (SELECT id FROM modifier_groups WHERE branch_id = get_my_branch_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Opciones de extras escritura admin" ON modifier_options;
CREATE POLICY "Opciones de extras escritura admin" ON modifier_options
  FOR ALL USING (
    group_id IN (
      SELECT g.id FROM modifier_groups g
       WHERE g.branch_id = get_my_branch_id()
         AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- create_order_secure sigue igual de blindada que en la 022. Esperado: false,
-- true, true (anon no puede, authenticated y postgres sí).
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede,
       has_function_privilege('postgres',      p.oid, 'EXECUTE') AS postgres_puede
  FROM pg_proc p
 WHERE p.proname = 'create_order_secure'
   AND p.pronamespace = 'public'::regnamespace;

-- Tablas nuevas y columna. Esperado: 2 y 1.
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name IN ('modifier_groups','modifier_options'))                AS tablas_nuevas,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'web_order_items' AND column_name = 'modifiers')        AS columna_modifiers;
