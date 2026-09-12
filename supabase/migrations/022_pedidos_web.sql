-- ============================================================
-- 022 — Pedidos web: el cliente pide desde el link, el local confirma
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Hasta ahora la carta pública era de sólo lectura: el cliente miraba, después
-- escribía por WhatsApp, y alguien copiaba el pedido a mano en el POS. Esto
-- cierra el circuito: el cliente arma el carrito y el pedido entra solo.
--
-- Decisión tomada con el dueño: un pedido de la web NO es una venta hasta que
-- el local lo confirma. Por eso vive en su propia tabla y no en orders con un
-- estado nuevo. El motivo es concreto, verificado contra el código:
--   - FinancialPage suma TODOS los pedidos del rango, sin mirar el estado.
--   - cash/repository (sumarVentas, contarSinCobrar) agrupa por forma de pago,
--     también sin mirar el estado.
--   - create_order_secure descuenta stock en el INSERT, incondicionalmente.
-- Un estado PENDING_CONFIRMATION obligaría a tocar esos tres lugares y a partir
-- en dos la función de pedidos, que ya se reescribió cuatro veces (009, 011,
-- 017 y 019). Una tabla aparte no toca ninguna pantalla existente: lo que no
-- está en orders no puede contarse como venta por descuido.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — Configuración del canal web, por sucursal
-- ------------------------------------------------------------
-- Tabla propia y no una columna en delivery_settings: por la web también se
-- pide para retirar, y un local que no reparte igual quiere vender online.
-- Atarlo al delivery obligaría a prender el reparto para poder vender takeaway.
CREATE TABLE IF NOT EXISTS web_settings (
  branch_id        UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- DEFAULT false, al revés que delivery_enabled en la 021. Allá se apagaba
  -- algo que ya venía funcionando; acá todavía no existe nada, y prenderlo sin
  -- número de WhatsApp cargado dejaría al cliente pidiendo contra la nada.
  enabled          BOOLEAN NOT NULL DEFAULT false,

  -- Distinto de enabled: es el "hoy no damos abasto" de un sábado a la noche.
  -- Se apaga y se prende sin perder toda la configuración.
  paused           BOOLEAN NOT NULL DEFAULT false,

  -- Sólo dígitos con código de país: es lo que va en el link de wa.me. No se
  -- reusa branches.phone porque ahí se carga texto libre ("11 4567-8900").
  whatsapp_phone   TEXT,

  min_order        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),

  -- No hay pago online: el efectivo se lo cobra quien lleva el pedido y la
  -- transferencia se arregla por WhatsApp. transfer_info es el alias o CBU que
  -- se le muestra al cliente cuando elige esa opción.
  accepts_cash     BOOLEAN NOT NULL DEFAULT true,
  accepts_transfer BOOLEAN NOT NULL DEFAULT false,
  transfer_info    TEXT,

  takeaway_enabled BOOLEAN NOT NULL DEFAULT true,
  prep_minutes     INT CHECK (prep_minutes IS NULL OR prep_minutes > 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT web_settings_whatsapp_digitos
    CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]{8,15}$'),
  -- Prender el canal sin número deja al cliente sin a dónde mandar el mensaje.
  CONSTRAINT web_settings_enabled_necesita_whatsapp
    CHECK (NOT enabled OR whatsapp_phone IS NOT NULL),
  CONSTRAINT web_settings_alguna_forma_de_pago
    CHECK (NOT enabled OR accepts_cash OR accepts_transfer)
);


-- ------------------------------------------------------------
-- PARTE B — El pedido que entra por la web
-- ------------------------------------------------------------
-- Numeración propia y corta, para que el cliente y el local hablen del mismo
-- pedido por WhatsApp. Global y no por sucursal a propósito: por sucursal haría
-- falta un contador con lock, y al cliente el número le da igual mientras sea
-- el mismo de los dos lados.
CREATE SEQUENCE IF NOT EXISTS web_orders_code_seq START 1000;

CREATE TABLE IF NOT EXISTS web_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code             BIGINT NOT NULL DEFAULT nextval('web_orders_code_seq'),

  -- EXPIRED existe para que una limpieza futura pueda barrer lo que nadie miró
  -- sin confundirlo con un rechazo explícito del local.
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','CONFIRMED','REJECTED','EXPIRED')),

  customer_name    TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 2 AND 80),
  customer_phone   TEXT NOT NULL CHECK (customer_phone ~ '^[0-9]{6,15}$'),
  customer_address TEXT,

  order_type       TEXT NOT NULL CHECK (order_type IN ('DELIVERY','TAKEAWAY')),

  -- Los mismos literales que usa el POS (client/src/lib/mediosDePago.ts). Si
  -- acá entrara 'EFECTIVO' o 'TRANSFERENCIA', el arqueo de caja no lo contaría
  -- como efectivo y el Financiero mostraría una forma de pago inventada.
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('CASH','TRANSFER')),

  notes            TEXT CHECK (notes IS NULL OR length(notes) <= 500),

  -- Congelado al momento de pedir, igual que los items: es lo que el cliente
  -- vio antes de apretar confirmar.
  items_total      NUMERIC(10,2) NOT NULL CHECK (items_total >= 0),
  delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,

  -- La genera el navegador antes de mandar. Como al confirmar se lo redirige a
  -- WhatsApp, volver atrás y reenviar es lo normal y no la excepción: sin esto
  -- el local recibe el mismo pedido dos y tres veces.
  idempotency_key  UUID NOT NULL,

  -- Se llena solo con el minuto del alta. Existe para poder indexarlo: sostiene
  -- el freno de la PARTE C sin que la aplicación tenga que acordarse de nada.
  created_minute   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  client_ip        INET,

  -- El pedido real que salió de éste. UNIQUE: aunque algo llame a confirmar dos
  -- veces, la base no deja que dos web_orders apunten al mismo pedido.
  order_id         UUID UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  confirmed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_at     TIMESTAMPTZ,
  rejected_reason  TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un envío sin dirección es un pedido que no se puede entregar.
  CONSTRAINT web_orders_delivery_con_direccion
    CHECK (order_type <> 'DELIVERY' OR nullif(trim(customer_address), '') IS NOT NULL)
);

-- El nombre y el precio quedan escritos acá y no se leen de products al mostrar
-- el pedido: entre que el cliente pidió y el local confirmó, el dueño pudo
-- cambiar el precio o renombrar el plato. El local tiene que ver EXACTAMENTE lo
-- que el cliente aceptó pagar. Mismo criterio que waiter_commission_pct (021).
--
-- product_id con ON DELETE SET NULL: borrar un producto no puede borrar el
-- historial de pedidos que lo pidieron.
CREATE TABLE IF NOT EXISTS web_order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  web_order_id UUID NOT NULL REFERENCES web_orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity     INT NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  -- Nota libre por producto ("sin cebolla"). No hay modificadores configurables.
  notes        TEXT CHECK (notes IS NULL OR length(notes) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_web_order_items_pedido
  ON web_order_items (web_order_id);

-- La bandeja de "Pedidos web" siempre pregunta lo mismo: los de esta sucursal,
-- en este estado, los más nuevos arriba.
CREATE INDEX IF NOT EXISTS idx_web_orders_bandeja
  ON web_orders (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_orders_pedido_real
  ON web_orders (order_id) WHERE order_id IS NOT NULL;

-- orders no guardaba el teléfono del cliente en ningún lado: el delivery se
-- manejaba con la dirección escrita a mano y el teléfono por WhatsApp. Para un
-- pedido web es el único dato de contacto que hay.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
-- Nota general del pedido ("tocar timbre, 3B"). Tampoco existía.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;


-- ------------------------------------------------------------
-- PARTE C — Freno de avalancha
-- ------------------------------------------------------------
-- No hay rate limiting en ningún lado del repo, y uno en memoria no sirve: en
-- Vercel cada request puede caer en una instancia distinta y el contador nace
-- en cero. El freno va en la base, que es lo único compartido.
--
-- Este índice es el freno duro: un mismo teléfono no puede meter dos pedidos en
-- la misma sucursal dentro del mismo minuto. Al ser un índice y no un chequeo
-- previo no hay ventana de carrera: dos requests simultáneas no pueden contar
-- cero las dos.
--
-- Cómo lo trata Express: ante un 23505 vuelve a buscar por idempotency_key. Si
-- lo encuentra era un reenvío y devuelve ese pedido como si fuera nuevo; si no,
-- era otro pedido distinto demasiado pronto y devuelve 429.
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_orders_un_pedido_por_minuto
  ON web_orders (branch_id, customer_phone, created_minute);

-- Reenvío del mismo pedido (doble tap, volver atrás desde WhatsApp, refresh).
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_orders_idempotencia
  ON web_orders (branch_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_web_orders_telefono
  ON web_orders (branch_id, customer_phone, created_at DESC);

-- Los topes van en un trigger y no en Express por lo mismo que la 017 puso la
-- devolución de stock en la base: cubre cualquier camino que inserte, incluso
-- uno futuro que se olvide de validar. Los números son de restaurante chico: un
-- local no atiende 20 pedidos web sin confirmar ninguno, y una persona no hace
-- 4 pedidos distintos en una hora. Si un local crece, se suben acá.
CREATE OR REPLACE FUNCTION public.frenar_avalancha_de_pedidos_web()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pendientes_sucursal INT;
  v_del_telefono        INT;
BEGIN
  SELECT count(*) INTO v_pendientes_sucursal
    FROM web_orders
   WHERE branch_id = NEW.branch_id
     AND status = 'PENDING'
     AND created_at > now() - interval '2 hours';

  IF v_pendientes_sucursal >= 20 THEN
    -- ERRCODE elegido a propósito para que Express lo distinga de un error de
    -- datos y devuelva 429 en vez de 500.
    RAISE EXCEPTION 'Demasiados pedidos sin confirmar en esta sucursal'
      USING ERRCODE = '54000';
  END IF;

  SELECT count(*) INTO v_del_telefono
    FROM web_orders
   WHERE branch_id = NEW.branch_id
     AND customer_phone = NEW.customer_phone
     AND created_at > now() - interval '1 hour';

  IF v_del_telefono >= 4 THEN
    RAISE EXCEPTION 'Demasiados pedidos desde este teléfono'
      USING ERRCODE = '54000';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_frenar_avalancha_web ON web_orders;
CREATE TRIGGER trg_frenar_avalancha_web
  BEFORE INSERT ON web_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.frenar_avalancha_de_pedidos_web();


-- ------------------------------------------------------------
-- PARTE D — Confirmar: recién acá nace la venta
-- ------------------------------------------------------------
-- Envuelve a create_order_secure sin tocarle la firma. Va en la base y no en
-- Express porque las tres cosas que pasan al confirmar (marcar el web_order,
-- crear el pedido real y descontar el stock) tienen que ser una sola: si se
-- hacen en tres llamadas sueltas, un timeout de Vercel en el medio deja stock
-- descontado sin pedido, o el pedido marcado sin haberse creado.
--
-- El FOR UPDATE es el candado contra el doble confirmar: si dos personas del
-- local tocan el botón a la vez, la segunda espera y encuentra el pedido ya en
-- CONFIRMED. Sin esto entran dos pedidos y el stock se descuenta dos veces.
CREATE OR REPLACE FUNCTION public.confirmar_pedido_web(
  p_web_order_id UUID,
  p_user_id UUID,
  -- El local ya vio el cambio de precio en pantalla y lo aceptó. Sin esto en
  -- true, un pedido cuyo precio cambió no se confirma solo.
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

  -- Un producto dado de baja, borrado o movido a otra sucursal entre que el
  -- cliente pidió y el local confirmó no se puede vender solo: create_order_secure
  -- insertaría unit_price NULL y la venta explotaría con un mensaje inentendible.
  -- Se frena acá y lo decide una persona.
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

  -- Se cobra el precio de HOY, no el congelado: el congelado es para que el
  -- local vea qué aceptó el cliente, no para vender por debajo del costo si el
  -- dueño remarcó. Si difiere se avisa y no se confirma hasta que alguien lo
  -- apruebe (o llame al cliente).
  SELECT
      jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'quantity',   i.quantity,
        'price',      p.price,
        'modifiers',  NULL,
        'notes',      i.notes
      ) ORDER BY i.product_name),
      COALESCE(sum(p.price * i.quantity), 0),
      COALESCE(jsonb_agg(jsonb_build_object(
        'producto',      i.product_name,
        'precio_pedido', i.unit_price,
        'precio_hoy',    p.price
      )) FILTER (WHERE p.price IS DISTINCT FROM i.unit_price), '[]'::jsonb)
    INTO v_items, v_total_hoy, v_cambios
    FROM web_order_items i
    JOIN products p ON p.id = i.product_id
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

  -- OJO con p_total: desde la 019, create_order_secure le SUMA p_delivery_fee
  -- antes de insertar. Va el total de la COMIDA, no el gran total, o el envío
  -- se cobraría dos veces.
  --
  -- El costo del envío sí se respeta congelado: es el que el local le cotizó al
  -- cliente. Cambiar el precio de la zona no puede encarecerle un envío que ya
  -- se acordó por WhatsApp.
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

  -- create_order_secure se traga sus propias excepciones y devuelve
  -- {"status":"error"} SIN levantar error: si no se mira este campo, un fallo
  -- se ve como un éxito y el web_order queda confirmado sin venta detrás.
  IF v_res->>'status' <> 'success' THEN
    RETURN jsonb_build_object(
      'status','error',
      'message', COALESCE(v_res->>'message','No se pudo crear el pedido')
    );
  END IF;

  v_order_id := (v_res->>'order_id')::uuid;

  -- Datos que create_order_secure no sabe recibir. No se le toca la firma: ya
  -- se reescribió cuatro veces y cada vez puso en riesgo toda la venta.
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
    -- Ingredientes que quedaron en negativo. La venta se registra igual (017).
    'advertencias', COALESCE(v_res->'advertencias','[]'::jsonb)
  );
END;
$function$;


-- ------------------------------------------------------------
-- PARTE E — Blindaje de create_order_secure
-- ------------------------------------------------------------
-- Estado actual, verificado: create_order_secure es SECURITY DEFINER (o sea que
-- se saltea RLS) y no hay un solo REVOKE en las 21 migraciones anteriores. Con
-- la clave pública, que está commiteada en client/.env.production, cualquiera
-- puede llamarla y crear un pedido en el local que quiera, al precio que quiera.
-- Con el canal web abierto al mundo, eso deja de ser teórico.
--
-- Se aplica recorriendo el catálogo y no con la firma escrita a mano: la función
-- cambió de parámetros cuatro veces y la 011 tuvo que dropear cuatro variantes.
-- Adivinar cuál quedó viva es la forma de blindar la equivocada.
--
-- IMPORTANTE para el que venga después: los permisos se pierden con cada DROP
-- FUNCTION, y la 019 las dropea TODAS antes de recrear. Toda migración futura
-- que toque create_order_secure tiene que volver a llamar a esta función al
-- final, o el agujero se reabre en silencio.
CREATE OR REPLACE FUNCTION public.blindar_rpcs_de_pedidos()
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  r RECORD;
  v_n INT := 0;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS firma
      FROM pg_proc
     WHERE proname = 'create_order_secure'
       AND pronamespace = 'public'::regnamespace
  LOOP
    -- Hay que nombrar a anon explícitamente. Revocarle sólo a PUBLIC no alcanza:
    -- Supabase le da EXECUTE a anon de forma directa con ALTER DEFAULT
    -- PRIVILEGES, y ese permiso sobrevive al revoke de PUBLIC.
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.firma || ' FROM PUBLIC, anon';
    -- El POS la llama desde el navegador con la sesión del cajero
    -- (client/src/services/orderService.ts), así que authenticated la necesita.
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.firma || ' TO authenticated';
    v_n := v_n + 1;
  END LOOP;

  -- Confirmar y frenar entran SIEMPRE por el servidor (Express, rol postgres vía
  -- DATABASE_URL), que además es el dueño de la función y por eso conserva
  -- EXECUTE aunque se revoque todo lo demás. Nadie con la clave pública ni con
  -- una sesión de navegador tiene por qué poder confirmar un pedido.
  FOR r IN
    SELECT oid::regprocedure AS firma
      FROM pg_proc
     WHERE proname IN ('confirmar_pedido_web','frenar_avalancha_de_pedidos_web')
       AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.firma || ' FROM PUBLIC, anon, authenticated';
  END LOOP;

  RETURN 'create_order_secure blindada en ' || v_n || ' variante(s)';
END;
$function$;

SELECT public.blindar_rpcs_de_pedidos();


-- ------------------------------------------------------------
-- PARTE E2 — El pedido siempre cae en el local de quien lo manda
-- ------------------------------------------------------------
-- El REVOKE tapa a anon, pero no al resto: create_order_secure es SECURITY
-- DEFINER, o sea que se saltea RLS, y confía en el p_tenant_id y el p_branch_id
-- que le mandan. Cualquier usuario logueado de CUALQUIER local puede seguir
-- creando pedidos en el local de otro. Esto lo cierra sin tocarle la firma, por
-- el mismo motivo que la 021 metió al mozo con un trigger.
--
-- Corrige en vez de rechazar, a propósito: un pedido legítimo ya viene con el
-- tenant correcto y esto no lo toca; uno falsificado queda encuadrado en el
-- local de quien lo mandó. Si rechazara, un falso positivo dejaría a un local
-- sin poder vender, que es el peor resultado posible. Mismo criterio que la 017
-- con el stock en negativo.
CREATE OR REPLACE FUNCTION public.encuadrar_pedido_en_su_local()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant UUID;
  v_rol    TEXT;
BEGIN
  -- Sin JWT es el servidor entrando por DATABASE_URL (rol postgres): la
  -- confirmación de pedidos web y el panel de SuperAdmin pasan por acá y ya
  -- resolvieron el local del lado del servidor.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT tenant_id, role INTO v_tenant, v_rol FROM profiles WHERE id = auth.uid();

    -- Un perfil sin local asignado no se toca: no hay con qué corregirlo y
    -- frenarle la venta sería peor.
    IF v_tenant IS NULL OR v_rol = 'SUPER_ADMIN' THEN
      RETURN NEW;
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM v_tenant THEN
      RAISE WARNING 'Pedido con tenant ajeno reencuadrado: % -> %', NEW.tenant_id, v_tenant;
      NEW.tenant_id := v_tenant;
    END IF;

    -- Una sucursal que no es de este local es igual de falsa que el tenant.
    IF NEW.branch_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = v_tenant
       ) THEN
      NEW.branch_id := get_my_branch_id();
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Igual que trg_atribuir_mozo: la venta vale más que el encuadre.
    RAISE WARNING 'No se pudo encuadrar el pedido: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Corre después de trg_atribuir_mozo (los BEFORE se disparan por orden
-- alfabético del nombre) y no se pisan: aquél sólo escribe waiter_id.
DROP TRIGGER IF EXISTS trg_encuadrar_pedido ON orders;
CREATE TRIGGER trg_encuadrar_pedido
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.encuadrar_pedido_en_su_local();


-- ------------------------------------------------------------
-- PARTE F — RLS
-- ------------------------------------------------------------
-- Criterio estricto, el de la 018 (caja) y no el de la 012 (orders): acá NO va
-- el "OR auth.uid() IS NOT NULL", que en orders deja que cualquier usuario
-- logueado de cualquier local lea los pedidos de todos los demás.
--
-- No hay política de INSERT para nadie. El alta de un pedido web entra
-- exclusivamente por Express con el rol postgres, que es el único lugar donde el
-- total se recalcula contra los precios de la base. Sin política de INSERT,
-- nadie con la clave pública puede meter un pedido directo por PostgREST
-- salteándose ese recálculo.
ALTER TABLE web_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_order_items ENABLE ROW LEVEL SECURITY;

-- Cinturón y tiradores: Supabase le da permisos de tabla a anon por defecto.
-- Hoy RLS lo frena igual, pero si alguna vez alguien hace DISABLE ROW LEVEL
-- SECURITY para depurar, sin esto quedan expuestos los teléfonos y las
-- direcciones de todos los clientes del local.
REVOKE ALL ON TABLE web_settings, web_orders, web_order_items FROM anon;
GRANT SELECT ON TABLE web_settings, web_orders, web_order_items TO authenticated;
GRANT UPDATE ON TABLE web_orders TO authenticated;

DROP POLICY IF EXISTS "Pedidos web lectura sucursal" ON web_orders;
CREATE POLICY "Pedidos web lectura sucursal" ON web_orders
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- Sólo UPDATE: sirve para rechazar o marcar visto desde la pantalla. Confirmar
-- NO pasa por acá, pasa por confirmar_pedido_web del lado del servidor, que es
-- lo único que crea la venta y descuenta stock.
DROP POLICY IF EXISTS "Pedidos web actualizacion sucursal" ON web_orders;
CREATE POLICY "Pedidos web actualizacion sucursal" ON web_orders
  FOR UPDATE USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Items pedido web lectura" ON web_order_items;
CREATE POLICY "Items pedido web lectura" ON web_order_items
  FOR SELECT USING (
    web_order_id IN (SELECT id FROM web_orders WHERE branch_id = get_my_branch_id())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Config web lectura sucursal" ON web_settings;
CREATE POLICY "Config web lectura sucursal" ON web_settings
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- Abrir o cerrar el canal de venta online y fijar el mínimo de compra es del
-- dueño, no de quien atiende. Mismo criterio que las zonas de envío (019).
DROP POLICY IF EXISTS "Config web escritura admin" ON web_settings;
CREATE POLICY "Config web escritura admin" ON web_settings
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );
GRANT INSERT, UPDATE, DELETE ON TABLE web_settings TO authenticated;

-- Una fila por sucursal, apagada, para que la pantalla de configuración tenga
-- siempre algo que editar. La 021 aprendió esto por las malas: sin fila, el
-- cliente arma un objeto en memoria y los booleanos quedan undefined.
INSERT INTO web_settings (branch_id, tenant_id)
SELECT b.id, b.tenant_id FROM branches b WHERE b.tenant_id IS NOT NULL
ON CONFLICT (branch_id) DO NOTHING;


-- ------------------------------------------------------------
-- PARTE G — Realtime para la pantalla de Pedidos web
-- ------------------------------------------------------------
-- Mismo patrón que la 012 con orders. REPLICA IDENTITY FULL es lo que hace que
-- el payload traiga la fila entera: sin eso, el filtro por branch_id del cliente
-- no puede evaluarse en los UPDATE y DELETE, y la pantalla se pierde eventos.
--
-- web_order_items NO se publica: la pantalla trae el pedido completo de una
-- consulta al recibir el aviso, igual que hace useOrders con los pedidos.
ALTER TABLE public.web_orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'web_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE web_orders;
    RAISE NOTICE 'web_orders agregada a supabase_realtime';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Una sola versión de cada función. Esperado: 1, 1, 1.
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'create_order_secure')  AS v_create_order,
  (SELECT count(*) FROM pg_proc WHERE proname = 'confirmar_pedido_web') AS v_confirmar,
  (SELECT count(*) FROM pg_proc WHERE proname = 'close_table_bill')     AS v_close_bill;

-- LO MÁS IMPORTANTE DE ESTA MIGRACIÓN.
-- Esperado: dueno = postgres, anon_puede = false, authenticated_puede = true,
-- postgres_puede = true. Si anon_puede sigue en true, cualquiera puede crear
-- pedidos con la clave pública. Si authenticated_puede da false, el POS dejó de
-- poder vender: revisar antes de irse.
SELECT p.proname,
       pg_get_userbyid(p.proowner)                              AS dueno,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede,
       has_function_privilege('postgres',      p.oid, 'EXECUTE') AS postgres_puede
  FROM pg_proc p
 WHERE p.proname IN ('create_order_secure','confirmar_pedido_web')
   AND p.pronamespace = 'public'::regnamespace;

-- Triggers nuevos y el de la 021, todos vivos. Esperado: 1, 1, 1.
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname='trg_encuadrar_pedido'     AND NOT tgisinternal) AS trg_encuadre,
  (SELECT count(*) FROM pg_trigger WHERE tgname='trg_frenar_avalancha_web' AND NOT tgisinternal) AS trg_freno,
  (SELECT count(*) FROM pg_trigger WHERE tgname='trg_atribuir_mozo'        AND NOT tgisinternal) AS trg_mozo;

-- Ninguna sucursal puede quedar sin configuración web.
-- Esperado: los dos primeros iguales, el tercero 0 (nadie prendió nada todavía).
SELECT
  (SELECT count(*) FROM branches)                   AS sucursales,
  (SELECT count(*) FROM web_settings)               AS con_config,
  (SELECT count(*) FROM web_settings WHERE enabled) AS con_web_activa;

-- Realtime listo. Esperado: 1 y 'f' (FULL).
SELECT
  (SELECT count(*) FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='web_orders') AS en_publicacion,
  (SELECT relreplident FROM pg_class WHERE relname='web_orders')  AS replica_identity;

-- Consistencia del staging: nadie CONFIRMED sin pedido real, y ningún pedido
-- real referenciado desde la nada. Esperado: 0 y 0.
SELECT
  (SELECT count(*) FROM web_orders WHERE status='CONFIRMED' AND order_id IS NULL) AS confirmados_sin_venta,
  (SELECT count(*) FROM web_orders w WHERE w.order_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = w.order_id))             AS apuntando_a_la_nada;
