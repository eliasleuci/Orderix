-- ============================================================
-- 026 — Confirmar un pedido web fallaba cuando un item no tenía extras
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Al confirmar, la función sumaba los extras de cada item recorriendo
-- i.modifiers con jsonb_array_elements, protegido por
-- COALESCE(i.modifiers, '[]'::jsonb). Ese COALESCE sólo atrapa el NULL de
-- SQL, y lo que hay guardado en un item sin extras es el 'null' de JSON: un
-- escalar, no un NULL. Postgres cortaba con
--
--   22023: cannot extract elements from a scalar
--
-- y el pedido quedaba imposible de confirmar. Pasaba con cualquier pedido que
-- tuviera al menos un producto sin extras, o sea casi todos.
--
-- Se cambia el COALESCE por un chequeo de tipo: si modifiers no es un array
-- (sea NULL, sea 'null', sea cualquier cosa rara), se trata como lista vacía.
-- El mismo criterio al pasarlo a order_items, para no arrastrar el 'null'
-- escalar al pedido real.
--
-- La firma queda idéntica a la de la 023, así que los permisos no se pierden;
-- igual se vuelve a blindar, como pide la 021 cada vez que se toca una de
-- estas funciones.
-- ============================================================

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
        'modifiers',  CASE WHEN jsonb_typeof(i.modifiers) = 'array' THEN i.modifiers END,
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
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(i.modifiers) = 'array' THEN i.modifiers ELSE '[]'::jsonb END
             ) elem
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

SELECT public.blindar_rpcs_de_pedidos();

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Lo que rompía, aislado. Esperado: las tres filas en 0, sin error.
SELECT
    (SELECT sum((e->>'price')::numeric)
       FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof('null'::jsonb) = 'array' THEN 'null'::jsonb ELSE '[]'::jsonb END
            ) e) IS NULL AS json_null_ok,
    (SELECT sum((e->>'price')::numeric)
       FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(NULL::jsonb) = 'array' THEN NULL::jsonb ELSE '[]'::jsonb END
            ) e) IS NULL AS sql_null_ok,
    (SELECT sum((e->>'price')::numeric)
       FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof('[{"label":"x","price":100}]'::jsonb) = 'array'
                   THEN '[{"label":"x","price":100}]'::jsonb ELSE '[]'::jsonb END
            ) e) = 100 AS array_ok;

-- Cuántos items tienen guardado el 'null' escalar que disparaba el error.
SELECT count(*) AS items_con_json_null
  FROM web_order_items
 WHERE jsonb_typeof(modifiers) = 'null';

-- La función quedó blindada. Esperado: false / true / true.
SELECT
    has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede,
    has_function_privilege('postgres',      p.oid, 'EXECUTE') AS postgres_puede
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'confirmar_pedido_web';
