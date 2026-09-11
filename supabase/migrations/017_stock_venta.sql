-- ============================================================
-- 017 — Descuento de stock por venta: avisos y trazabilidad
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Qué corrige, verificado contra la base:
--
-- 1. Se podía vender sin stock y sin aviso. Un pedido de 99.999 unidades
--    teniendo ~100 devolvía "éxito" y dejaba el inventario en -399.908.
-- 2. Las ventas descontaban en silencio: stock_movements sólo tenía los
--    ajustes manuales, así que no había forma de reconstruir qué consumió
--    cada venta.
-- 3. Anular un pedido no devolvía los ingredientes al inventario.
--
-- Decisión de negocio tomada con el dueño: la venta SIEMPRE se registra
-- (bloquear la caja en pleno servicio es peor que un descuadre), pero el
-- sistema avisa qué ingrediente quedó en negativo. Y al anular un pedido
-- los ingredientes vuelven al stock.
-- ============================================================


-- ------------------------------------------------------------
-- PARTE A — Crear el pedido, descontar, registrar y avisar
-- ------------------------------------------------------------
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
  p_table_id UUID DEFAULT NULL
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
BEGIN
  INSERT INTO orders (
    tenant_id, branch_id, user_id, customer_name, customer_address,
    total, status, payment_method, order_type, table_id
  )
  VALUES (
    p_tenant_id, p_branch_id, p_user_id, p_customer_name, p_customer_address,
    p_total, 'PENDING', p_payment_method, p_order_type, p_table_id
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
-- PARTE B — Devolver el stock cuando se anula un pedido
-- ------------------------------------------------------------
-- Va como trigger y no en el código de la aplicación porque los pedidos se
-- borran desde tres lugares distintos (uno suelto, por rango de fechas y
-- todos los de una sucursal). Acá se cubre cualquier camino, incluso un
-- DELETE hecho a mano desde el SQL Editor.
CREATE OR REPLACE FUNCTION public.devolver_stock_pedido_anulado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_item     RECORD;
  v_recipe   RECORD;
  v_antes    NUMERIC;
  v_devuelto NUMERIC;
BEGIN
  -- Si se está borrando el cliente entero, sus ingredientes se van igual:
  -- devolver stock ahí no tiene sentido y puede fallar por las cascadas.
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = OLD.tenant_id) THEN
    RETURN OLD;
  END IF;

  FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = OLD.id
  LOOP
    FOR v_recipe IN
      SELECT ingredient_id, quantity FROM recipes WHERE product_id = v_item.product_id
    LOOP
      SELECT stock INTO v_antes
      FROM ingredients WHERE id = v_recipe.ingredient_id FOR UPDATE;

      IF v_antes IS NULL THEN
        CONTINUE;
      END IF;

      v_devuelto := v_recipe.quantity * v_item.quantity;

      UPDATE ingredients
      SET stock = stock + v_devuelto
      WHERE id = v_recipe.ingredient_id;

      INSERT INTO stock_movements (
        tenant_id, ingredient_id, type, quantity,
        stock_before, stock_after, reason
      )
      VALUES (
        OLD.tenant_id, v_recipe.ingredient_id, 'ADD', v_devuelto,
        v_antes, v_antes + v_devuelto,
        'Devolución - pedido anulado ' || left(OLD.id::text, 8)
      );
    END LOOP;
  END LOOP;

  RETURN OLD;
END;
$function$;

-- BEFORE DELETE: los order_items todavía existen. Con AFTER ya se los llevó
-- la cascada y no habría forma de saber qué devolver.
DROP TRIGGER IF EXISTS trg_devolver_stock_pedido ON orders;
CREATE TRIGGER trg_devolver_stock_pedido
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.devolver_stock_pedido_anulado();


-- ------------------------------------------------------------
-- PARTE C — Verificación
-- ------------------------------------------------------------
-- Productos sin receta: sus ventas no descuentan nada.
SELECT p.name AS producto_sin_receta
FROM products p
LEFT JOIN recipes r ON r.product_id = p.id
WHERE r.id IS NULL
ORDER BY p.name;

-- Ingredientes en negativo (se vendió más de lo que había).
SELECT name, stock FROM ingredients WHERE stock < 0 ORDER BY stock;
