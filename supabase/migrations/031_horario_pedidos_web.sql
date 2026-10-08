-- ============================================================
-- 031 — Horario de atención de los pedidos web
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- Sin horario (NULL) el link toma pedidos a cualquier hora, como hasta ahora.
-- Con horario, fuera de esos turnos la carta se puede mirar pero no se puede
-- pedir, y el servidor rechaza cualquier pedido que llegue igual.
--
-- Formato: { "0": [{ "desde": "20:00", "hasta": "01:00" }], ... }
-- La clave es el día como en JavaScript (0 = domingo). Un turno cuyo "hasta"
-- no es mayor que el "desde" termina al día siguiente.
-- ============================================================

ALTER TABLE web_settings ADD COLUMN IF NOT EXISTS schedule JSONB;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Columna nueva. Esperado: 1.
SELECT count(*) AS columna_nueva
  FROM information_schema.columns
 WHERE table_name = 'web_settings' AND column_name = 'schedule';
