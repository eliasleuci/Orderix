-- El cliente puede marcar el pin de su ubicación en el mapa al pedir por la
-- web (GPS o arrastrando el pin), además de escribir la dirección de siempre.
-- Opcionales: un pedido sigue entrando sin esto si no dio permiso de
-- ubicación o prefirió no tocar el mapa.
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS customer_lat DOUBLE PRECISION;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS customer_lng DOUBLE PRECISION;
