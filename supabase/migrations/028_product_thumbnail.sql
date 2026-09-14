-- Miniatura liviana para las grillas de Catálogo y Venta: hoy se usa la misma
-- imagen completa (hasta 1400px) tanto en la miniatura como en el modal de
-- edición, lo que pesa de más en cada carga de esas dos pantallas cuando hay
-- muchos productos. Se agrega una columna aparte, opcional, para no afectar
-- los productos ya cargados (siguen mostrando su image_url de siempre hasta
-- que se les guarde una miniatura nueva).
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
