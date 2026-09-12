import { z } from 'zod';

// Sólo dígitos: es lo que necesita el link de wa.me, y además evita que entre
// "no tengo" o un emoji en el único dato de contacto que va a tener el local.
const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 6 && v.length <= 15, 'Ingresá un teléfono válido');

const itemDelCarrito = z.object({
  productId: z.string().uuid('Producto inválido'),
  quantity: z.number().int().min(1).max(50, 'Demasiadas unidades de un mismo producto'),
  notes: z.string().trim().max(200).optional().nullable(),
});

export const crearPedidoSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object({ sucursal: z.string().uuid().optional() }).passthrough(),
  body: z.object({
    // La genera el navegador y la repite si el cliente reenvía. Sin esto, volver
    // atrás desde WhatsApp le duplica el pedido al local.
    idempotencyKey: z.string().uuid('Falta la clave del pedido'),
    customerName: z.string().trim().min(2, 'Poné tu nombre').max(80),
    customerPhone: telefono,
    customerAddress: z.string().trim().max(300).optional().nullable(),
    orderType: z.enum(['DELIVERY', 'TAKEAWAY']),
    paymentMethod: z.enum(['CASH', 'TRANSFER']),
    deliveryZoneId: z.string().uuid().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    items: z.array(itemDelCarrito).min(1, 'El carrito está vacío').max(50),
  }),
});

export const pedidoSchema = z.object({
  params: z.object({ id: z.string().uuid('Pedido inválido') }),
});

export const confirmarSchema = z.object({
  params: z.object({ id: z.string().uuid('Pedido inválido') }),
  body: z.object({
    // El local ya vio el cambio de precio en pantalla y lo aceptó.
    aceptarCambioDePrecio: z.boolean().optional(),
  }),
});

export const rechazarSchema = z.object({
  params: z.object({ id: z.string().uuid('Pedido inválido') }),
  body: z.object({ motivo: z.string().trim().max(300).optional().nullable() }),
});
