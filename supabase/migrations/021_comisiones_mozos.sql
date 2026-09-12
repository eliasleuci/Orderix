-- ============================================================
-- 021 — Comisión del mozo y sucursales que no hacen delivery
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Parte 1. El mozo se guardaba sólo en la mesa (020) y la mesa se libera al
-- cobrar: una vez pagada la cuenta no quedaba registro de quién la atendió.
-- Como al mozo se le paga comisión sobre lo que vendió, esa atribución tiene
-- que vivir en el pedido, que no se borra nunca. Mismo criterio que el
-- repartidor del delivery (019).
--
-- Parte 2. Hay locales que no hacen envíos y les sobra todo el flujo de
-- delivery en pantalla. Un interruptor por sucursal lo esconde.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — La comisión que cobra cada mozo
-- ------------------------------------------------------------
ALTER TABLE waiters
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (commission_pct >= 0 AND commission_pct <= 100);

COMMENT ON COLUMN waiters.commission_pct IS
  'Porcentaje sobre la venta que cobra el mozo. 0 = sin comisión.';


-- ------------------------------------------------------------
-- PARTE B — El mozo queda escrito en el pedido
-- ------------------------------------------------------------
-- ON DELETE SET NULL como en 019: dar de baja a un mozo no puede borrar los
-- pedidos que vendió. Ojo que sí le borra la atribución a esos pedidos, así
-- que a un mozo que se va se lo marca is_active = false, no se lo elimina.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL;

-- El porcentaje se congela en el pedido, no se lee de waiters al liquidar.
-- Si el dueño le sube la comisión a un mozo en marzo, lo que ya se le pagó en
-- febrero no puede cambiar solo. Mismo criterio que el arqueo de caja (018).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waiter_commission_pct NUMERIC(5,2);

-- Liquidar comisiones es siempre "un mozo, un rango de fechas".
CREATE INDEX IF NOT EXISTS idx_orders_waiter
  ON orders (waiter_id, created_at DESC) WHERE waiter_id IS NOT NULL;

-- Los pedidos de una cuenta abierta se consultan al cobrar la mesa y ahora
-- también desde el trigger de acá abajo.
CREATE INDEX IF NOT EXISTS idx_orders_mesa_abierta
  ON orders (table_id) WHERE payment_method = 'UNPAID';


-- ------------------------------------------------------------
-- PARTE C — Copiar el mozo de la mesa al pedido
-- ------------------------------------------------------------
-- Va como trigger y no como parámetro de create_order_secure a propósito: esa
-- función ya se reescribió cuatro veces (009, 011, 017 y 019) y la 011 tuvo
-- que dropear cuatro variantes sobrecargadas. Cada reescritura pone en riesgo
-- TODA la carga de pedidos; un trigger no le toca la firma y además cubre
-- cualquier camino que inserte pedidos, incluso los que no existen todavía.
-- Es el mismo criterio que tomó la 017 para devolver stock.
CREATE OR REPLACE FUNCTION public.atribuir_mozo_al_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Sin search_path fijo, el trigger corre con el del que llama: desde
-- create_order_secure sería el definer, pero desde un insert directo de
-- PostgREST sería el del usuario autenticado.
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_mozo UUID;
BEGIN
  -- Sin mesa no hay mozo que atribuir: mostrador y delivery salen por acá sin
  -- tocar nada. Se filtra por table_id y no por order_type porque order_type
  -- es texto libre con default 'TAKEAWAY' y no es confiable.
  IF NEW.table_id IS NULL OR NEW.waiter_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Todo el cuerpo va envuelto en su propio EXCEPTION que se traga cualquier
  -- error. create_order_secure atrapa las excepciones y las devuelve como
  -- {"status":"error"} SIN crear el pedido, así que una falla acá dejaría al
  -- local sin poder vender. Saber quién atendió es contabilidad; la venta vale
  -- más. Si algo falla, el pedido entra sin mozo y se corrige a mano.
  BEGIN
    -- Mesas unidas: la hija nunca recibe mozo propio (joinTable sólo escribe
    -- parent_table_id) pero el POS la deja elegir igual. Se cae a la madre.
    SELECT COALESCE(hija.waiter_id, madre.waiter_id)
      INTO v_mozo
      FROM tables hija
      LEFT JOIN tables madre ON madre.id = hija.parent_table_id
     WHERE hija.id = NEW.table_id;

    -- Red de seguridad: si la mesa quedó sin mozo, se toma el del último
    -- pedido de la MISMA cuenta abierta. Cubre el caso de que algo vuelva a
    -- ocupar la mesa sin mandar el mozo y lo borre a mitad del servicio.
    IF v_mozo IS NULL THEN
      SELECT o.waiter_id INTO v_mozo
        FROM orders o
       WHERE o.waiter_id IS NOT NULL
         AND o.payment_method = 'UNPAID'
         AND (o.table_id = NEW.table_id
              OR o.table_id IN (SELECT id FROM tables WHERE parent_table_id = NEW.table_id)
              OR o.table_id = (SELECT parent_table_id FROM tables WHERE id = NEW.table_id))
       ORDER BY o.created_at DESC
       LIMIT 1;
    END IF;

    NEW.waiter_id := v_mozo;

    IF NEW.waiter_id IS NOT NULL AND NEW.waiter_commission_pct IS NULL THEN
      SELECT commission_pct INTO NEW.waiter_commission_pct
        FROM waiters WHERE id = NEW.waiter_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo atribuir el mozo del pedido: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Sólo en INSERT: una corrección hecha a mano sobre orders.waiter_id no se
-- puede pisar sola.
DROP TRIGGER IF EXISTS trg_atribuir_mozo ON orders;
CREATE TRIGGER trg_atribuir_mozo
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.atribuir_mozo_al_pedido();


-- ------------------------------------------------------------
-- PARTE D — Cobrar la mesa también cierra la atribución
-- ------------------------------------------------------------
-- Dos arreglos sobre la versión de la 014:
--
-- 1. Liberaba la mesa pero NO limpiaba waiter_id. Como freeTable() del cliente
--    no se llama desde ningún lado, ésta es la única vuelta a FREE que existe:
--    hoy toda mesa cobrada queda con el mozo del turno anterior pegado, y el
--    próximo servicio se le atribuye a quien ya se fue.
-- 2. Al cerrar, cualquier pedido de la cuenta que haya quedado sin mozo toma
--    el de la mesa. Es la última red antes de que el pedido se congele.
--
-- Firma idéntica (UUID, TEXT) -> JSONB, así que el REPLACE la pisa en el lugar
-- y no genera una sobrecarga como pasó con create_order_secure.
CREATE OR REPLACE FUNCTION close_table_bill(
    p_table_id UUID,
    p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_updated_orders INT;
BEGIN
    WITH mesa AS (
        SELECT waiter_id FROM tables WHERE id = p_table_id
    ),
    updated AS (
        UPDATE orders o
           SET payment_method = p_payment_method,
               waiter_id = COALESCE(o.waiter_id, (SELECT waiter_id FROM mesa)),
               waiter_commission_pct = COALESCE(
                   o.waiter_commission_pct,
                   (SELECT w.commission_pct FROM waiters w
                     WHERE w.id = COALESCE(o.waiter_id, (SELECT waiter_id FROM mesa)))
               )
         WHERE (o.table_id = p_table_id
                OR o.table_id IN (SELECT id FROM tables WHERE parent_table_id = p_table_id))
           AND o.payment_method = 'UNPAID'
        RETURNING o.id
    )
    SELECT count(*) INTO v_updated_orders FROM updated;

    -- Liberar la mesa madre. El mozo se va con la mesa.
    UPDATE tables
       SET status = 'FREE',
           customer_name = NULL,
           notes = NULL,
           opened_at = NULL,
           waiter_id = NULL
     WHERE id = p_table_id;

    -- Liberar y desvincular las hijas.
    UPDATE tables
       SET status = 'FREE',
           customer_name = NULL,
           notes = NULL,
           opened_at = NULL,
           waiter_id = NULL,
           parent_table_id = NULL
     WHERE parent_table_id = p_table_id;

    RETURN jsonb_build_object('status', 'success', 'orders_closed', v_updated_orders);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$function$;

-- Limpieza de lo que dejó el bug: las mesas que ya se cobraron antes de esta
-- migración quedaron libres pero con el mozo pegado. Sin esto, la primera
-- mesa que se abra después de la migración arrastraría a quien la atendió la
-- última vez. Sólo toca mesas libres: una ocupada está en pleno servicio.
UPDATE tables
   SET waiter_id = NULL
 WHERE status = 'FREE' AND waiter_id IS NOT NULL;


-- ------------------------------------------------------------
-- PARTE E — Sucursales que no hacen delivery
-- ------------------------------------------------------------
-- DEFAULT true y no false: hoy TODAS las sucursales tienen el delivery a la
-- vista. Con default false, cada local que ya vendía por envío se quedaría sin
-- el botón de un día para el otro sin haber tocado nada. Apagar algo que está
-- funcionando es una decisión del dueño, no de una migración.
ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT true;

-- La mayoría de las sucursales no tiene fila en delivery_settings: recién se
-- crea cuando alguien guarda la configuración de km. Sin fila, el cliente arma
-- un objeto por defecto en memoria, y ahí delivery_enabled quedaría undefined
-- -> falso -> delivery escondido en locales que sí reparten. Se les crea la
-- fila con los mismos valores que ya devolvía ese objeto, más el envío activo.
INSERT INTO delivery_settings (branch_id, tenant_id)
SELECT b.id, b.tenant_id
  FROM branches b
 WHERE b.tenant_id IS NOT NULL
ON CONFLICT (branch_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Una sola versión de cada función y el trigger creado.
-- Esperado: 1, 1, 1.
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'create_order_secure') AS v_create_order,
  (SELECT count(*) FROM pg_proc WHERE proname = 'close_table_bill')    AS v_close_bill,
  (SELECT count(*) FROM pg_trigger
    WHERE tgname = 'trg_atribuir_mozo' AND NOT tgisinternal)           AS trigger_mozo;

-- Columnas nuevas. Esperado: 4.
SELECT count(*) AS columnas_nuevas
  FROM information_schema.columns
 WHERE (table_name = 'orders'            AND column_name IN ('waiter_id','waiter_commission_pct'))
    OR (table_name = 'waiters'           AND column_name = 'commission_pct')
    OR (table_name = 'delivery_settings' AND column_name = 'delivery_enabled');

-- Ninguna sucursal puede quedar sin configuración de envío.
-- Esperado: los tres números iguales.
SELECT
  (SELECT count(*) FROM branches)                                 AS sucursales,
  (SELECT count(*) FROM delivery_settings)                        AS con_config,
  (SELECT count(*) FROM delivery_settings WHERE delivery_enabled) AS con_delivery_activo;

-- Mesas libres que todavía arrastran un mozo. Esperado: 0.
SELECT count(*) AS mesas_libres_con_mozo
  FROM tables WHERE status = 'FREE' AND waiter_id IS NOT NULL;
