-- ============================================================
-- 019 — Delivery: zonas con precio, cobro por km y repartidores
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Hasta ahora DELIVERY era sólo un tipo de pedido con la dirección escrita a
-- mano: el costo del envío no se registraba en ningún lado. El local lo cobraba
-- sumándolo mentalmente al total, así que no había forma de saber cuánto se
-- facturó por envíos ni de separarlo de la comida.
--
-- Zona y barrio son lo mismo para el sistema: un área con nombre y precio fijo.
-- Va una sola tabla y el local decide si la llama "Centro" o "Villa Crespo".
-- El cobro por km es el otro modo: precio base + precio por km, con los km
-- cargados a mano por quien atiende.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — Zonas de envío
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dos zonas con el mismo nombre en la misma sucursal serían indistinguibles en
-- el desplegable del POS.
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_zones_nombre
  ON delivery_zones (branch_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_delivery_zones_branch
  ON delivery_zones (branch_id, is_active);


-- ------------------------------------------------------------
-- PARTE B — Configuración del cobro por km
-- ------------------------------------------------------------
-- Una fila por sucursal. Si km_enabled queda en false, el POS ni ofrece la
-- opción y el local trabaja sólo con zonas.
CREATE TABLE IF NOT EXISTS delivery_settings (
  branch_id     UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  km_enabled    BOOLEAN NOT NULL DEFAULT false,
  km_base_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (km_base_price >= 0),
  km_price      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (km_price >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- PARTE C — Repartidores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_drivers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_branch
  ON delivery_drivers (branch_id, is_active);


-- ------------------------------------------------------------
-- PARTE D — Datos del envío en el pedido
-- ------------------------------------------------------------
-- delivery_fee va aparte de total (que lo incluye) para poder separar después
-- cuánto fue comida y cuánto fue envío. Sin la columna, esa plata queda
-- mezclada en el total y no hay forma de desglosarla.
--
-- ON DELETE SET NULL en zona y repartidor: borrar una zona no puede borrar el
-- historial de pedidos que la usaron.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_km  NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id   UUID REFERENCES delivery_zones(id)   ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver
  ON orders (delivery_driver_id) WHERE delivery_driver_id IS NOT NULL;


-- ------------------------------------------------------------
-- PARTE E — create_order_secure con datos de envío
-- ------------------------------------------------------------
-- Se borra TODA versión anterior antes de crear la nueva. Con CREATE OR REPLACE
-- solo, los parámetros nuevos generarían una SEGUNDA función sobrecargada y una
-- llamada con los argumentos viejos quedaría ambigua ("function is not unique"),
-- rompiendo la carga de pedidos.
--
-- Se borran por catálogo y no por firma escrita a mano: esta función ya cambió
-- de parámetros tres veces (migraciones 009, 011 y 017) y la 011 tuvo que
-- dropear cuatro variantes distintas. Adivinar cuáles quedaron vivas en esta
-- base es justamente la forma de que sobreviva una y rompa los pedidos.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS firma
    FROM pg_proc
    WHERE proname = 'create_order_secure'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.firma;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_user_id UUID,
  p_customer_name TEXT,
  p_customer_address TEXT,
  p_items JSONB,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_order_type TEXT DEFAULT 'TAKEAWAY',
  p_table_id UUID DEFAULT NULL,
  -- Nuevos, todos con default: una llamada sin ellos se comporta igual que antes.
  p_delivery_fee NUMERIC DEFAULT 0,
  p_delivery_zone_id UUID DEFAULT NULL,
  p_delivery_km NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order_id   UUID;
  v_item       RECORD;
  v_recipe     RECORD;
  v_antes      NUMERIC;
  v_descuento  NUMERIC;
  v_avisos     JSONB := '[]'::jsonb;
  v_envio      NUMERIC := COALESCE(p_delivery_fee, 0);
BEGIN
  -- p_total es el total de los productos; el envío se suma acá. Así quien
  -- llama no tiene que acordarse de incluirlo y no hay dos criterios dando
  -- vueltas sobre qué significa el total.
  INSERT INTO orders (
    tenant_id, branch_id, user_id, customer_name, customer_address,
    total, status, payment_method, order_type, table_id,
    delivery_fee, delivery_zone_id, delivery_km
  )
  VALUES (
    p_tenant_id, p_branch_id, p_user_id, p_customer_name, p_customer_address,
    p_total + v_envio, 'PENDING', p_payment_method, p_order_type, p_table_id,
    v_envio, p_delivery_zone_id, p_delivery_km
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id UUID, quantity INT, price DECIMAL, modifiers JSONB, notes TEXT)
  LOOP
    INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price, modifiers, notes)
    VALUES (p_tenant_id, v_order_id, v_item.product_id, v_item.quantity,
            v_item.price, v_item.modifiers, v_item.notes);

    -- Un producto sin receta cargada no descuenta nada: el bucle no itera.
    FOR v_recipe IN
      SELECT r.ingredient_id, r.quantity, i.name
      FROM recipes r
      JOIN ingredients i ON i.id = r.ingredient_id
      WHERE r.product_id = v_item.product_id
    LOOP
      -- FOR UPDATE bloquea el ingrediente: si dos cajas venden a la vez, una
      -- espera a la otra en lugar de pisarse el descuento.
      SELECT stock INTO v_antes
      FROM ingredients WHERE id = v_recipe.ingredient_id FOR UPDATE;

      IF v_antes IS NULL THEN
        CONTINUE;
      END IF;

      v_descuento := v_recipe.quantity * v_item.quantity;

      UPDATE ingredients
      SET stock = stock - v_descuento
      WHERE id = v_recipe.ingredient_id;

      -- Deja el rastro de la venta, para poder cuadrar el inventario después.
      INSERT INTO stock_movements (
        tenant_id, ingredient_id, user_id, type, quantity,
        stock_before, stock_after, reason
      )
      VALUES (
        p_tenant_id, v_recipe.ingredient_id, p_user_id, 'REMOVE', v_descuento,
        v_antes, v_antes - v_descuento,
        'Venta - pedido ' || left(v_order_id::text, 8)
      );

      -- No se frena la venta: se informa para que la caja lo vea y el dueño
      -- sepa que ese insumo quedó descuadrado.
      IF v_antes - v_descuento < 0 THEN
        v_avisos := v_avisos || jsonb_build_object(
          'ingrediente', v_recipe.name,
          'disponible',  v_antes,
          'necesario',   v_descuento,
          'faltante',    v_descuento - v_antes
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'order_id', v_order_id,
    'advertencias', v_avisos
  );
EXCEPTION WHEN OTHERS THEN
  -- Al capturar la excepción, Postgres deshace todo lo hecho en el bloque:
  -- no queda un pedido a medio crear.
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$function$;


-- ------------------------------------------------------------
-- PARTE F — RLS
-- ------------------------------------------------------------
ALTER TABLE delivery_zones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_drivers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zonas lectura sucursal" ON delivery_zones;
CREATE POLICY "Zonas lectura sucursal" ON delivery_zones
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- Definir cuánto se cobra por un envío es decisión del dueño, no de quien atiende.
DROP POLICY IF EXISTS "Zonas escritura admin" ON delivery_zones;
CREATE POLICY "Zonas escritura admin" ON delivery_zones
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Config envio lectura sucursal" ON delivery_settings;
CREATE POLICY "Config envio lectura sucursal" ON delivery_settings
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Config envio escritura admin" ON delivery_settings;
CREATE POLICY "Config envio escritura admin" ON delivery_settings
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Repartidores lectura sucursal" ON delivery_drivers;
CREATE POLICY "Repartidores lectura sucursal" ON delivery_drivers
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS "Repartidores escritura admin" ON delivery_drivers;
CREATE POLICY "Repartidores escritura admin" ON delivery_drivers
  FOR ALL USING (
    (branch_id = get_my_branch_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN')
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Debe devolver UNA sola fila: si aparecen dos, quedó la función vieja dando
-- vueltas y los pedidos van a fallar por ambigüedad.
SELECT count(*) AS versiones_de_create_order_secure
FROM pg_proc WHERE proname = 'create_order_secure';

SELECT
  (SELECT count(*) FROM delivery_zones)   AS zonas,
  (SELECT count(*) FROM delivery_drivers) AS repartidores;
