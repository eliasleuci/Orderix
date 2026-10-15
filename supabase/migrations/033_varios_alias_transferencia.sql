-- ============================================================
-- 033 — Varios alias de transferencia, uno en uso
-- ============================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor
--
-- El dueño rota la cuenta a la que le transfieren (una semana un alias, otra
-- semana otro) y tenía que borrar y reescribir el alias cada vez.
--
-- transfer_aliases guarda todos los cargados: [{ "alias": "...", "activo": true }].
-- transfer_info sigue siendo el que se le muestra al cliente y siempre es el
-- que está activo: así el pedido web y el servidor no cambian.
-- ============================================================

ALTER TABLE web_settings ADD COLUMN IF NOT EXISTS transfer_aliases JSONB;

-- Lo que ya estaba cargado pasa a ser el primer alias de la lista, en uso.
UPDATE web_settings
   SET transfer_aliases = jsonb_build_array(jsonb_build_object('alias', transfer_info, 'activo', true))
 WHERE transfer_aliases IS NULL
   AND transfer_info IS NOT NULL
   AND length(trim(transfer_info)) > 0;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- Columna nueva. Esperado: 1.
SELECT count(*) AS columna_nueva
  FROM information_schema.columns
 WHERE table_name = 'web_settings' AND column_name = 'transfer_aliases';

-- Sucursales con alias cargado que no quedaron en la lista. Esperado: 0.
SELECT count(*) AS sin_migrar
  FROM web_settings
 WHERE transfer_info IS NOT NULL AND length(trim(transfer_info)) > 0
   AND transfer_aliases IS NULL;
