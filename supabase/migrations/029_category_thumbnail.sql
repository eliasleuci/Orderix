-- Miniatura liviana para las fotos de categoría, igual que 028 para productos:
-- la grilla de categorías del pedido web (/pedir/:slug) es lo primero que ve
-- el cliente y hoy baja la foto completa (hasta 1400px) para un cuadradito.
-- Opcional, para no afectar las categorías ya cargadas hasta que se les
-- guarde una miniatura nueva.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
