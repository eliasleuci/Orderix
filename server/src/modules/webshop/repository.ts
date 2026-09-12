import { basePrisma, prisma } from '../../config/database';

/** Lo que el cliente ve y lo que el local cobra: nada de datos internos. */
const PRODUCTO_PUBLICO = {
  id: true,
  name: true,
  description: true,
  price: true,
  image: true,
  category: { select: { id: true, name: true, imageUrl: true, displayOrder: true, isActive: true } },
  // Sólo el nombre del ingrediente. Las cantidades de la receta son información
  // de costos del local y no tienen por qué salir al público.
  recipe: { select: { ingredient: { select: { name: true, is_active: true } } } },
  // Grupos activos con sus opciones activas, en el orden que definió el dueño.
  modifierGroups: {
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      minSelect: true,
      maxSelect: true,
      options: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, name: true, price: true },
      },
    },
  },
} as const;

export class WebshopRepository {
  /**
   * El tenant se busca con basePrisma a propósito: todavía no hay tenant en el
   * contexto porque el pedido entra sin sesión, así que es la única consulta
   * que corre sin el filtro automático.
   */
  async findTenantBySlug(slug: string) {
    return basePrisma.tenant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
  }

  async findActiveBranches(tenantId: string) {
    return basePrisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, location: true, phone: true },
      orderBy: { name: 'asc' },
    });
  }

  async findWebSettings(branchId: string) {
    return prisma.webSettings.findFirst({ where: { branchId } });
  }

  async findDeliverySettings(branchId: string) {
    return prisma.deliverySettings.findFirst({ where: { branchId } });
  }

  /** Sólo las zonas activas: una pausada no se le ofrece al cliente. */
  async findZonas(branchId: string) {
    return prisma.deliveryZone.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    });
  }

  async findMenuProducts(branchId: string) {
    return prisma.product.findMany({
      where: { branchId, isActive: true },
      select: PRODUCTO_PUBLICO,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Precios para cotizar el carrito, con sus grupos de extras activos (para
   * validar y precisar lo que el cliente eligió). Se filtra por sucursal
   * además de por id: sin eso, un id de producto de otro local cotizaría el
   * carrito de éste.
   */
  async findPreciosParaCotizar(branchId: string, ids: string[]) {
    return prisma.product.findMany({
      where: { id: { in: ids }, branchId, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        modifierGroups: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            minSelect: true,
            maxSelect: true,
            options: { where: { isActive: true }, select: { id: true, name: true, price: true } },
          },
        },
      },
    });
  }

  async findZonaParaCotizar(branchId: string, zonaId: string) {
    return prisma.deliveryZone.findFirst({
      where: { id: zonaId, branchId, isActive: true },
      select: { id: true, price: true },
    });
  }

  async findPorIdempotencia(branchId: string, idempotencyKey: string) {
    return prisma.webOrder.findFirst({
      where: { branchId, idempotencyKey },
      include: { items: true },
    });
  }

  async crearPedido(data: any, items: any[]) {
    return prisma.webOrder.create({
      data: { ...data, items: { create: items } } as any,
      include: { items: true },
    });
  }

  async findPedidos(branchId: string, estados: string[], limit: number) {
    return prisma.webOrder.findMany({
      where: { branchId, status: { in: estados } },
      include: { items: true, deliveryZone: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findPedido(id: string, branchId: string) {
    return prisma.webOrder.findFirst({
      where: { id, branchId },
      include: { items: true, deliveryZone: { select: { name: true } } },
    });
  }

  /**
   * Confirmar es una sola operación en la base y no tres llamadas desde acá:
   * marcar el pedido, crear la venta y descontar el stock tienen que pasar
   * juntas o no pasar. Un corte en el medio dejaría stock descontado sin venta.
   */
  async confirmar(id: string, userId: string, aceptarCambioDePrecio: boolean) {
    const filas = await basePrisma.$queryRaw<{ confirmar_pedido_web: any }[]>`
      SELECT public.confirmar_pedido_web(
        ${id}::uuid, ${userId}::uuid, ${aceptarCambioDePrecio}::boolean
      )
    `;
    return filas[0]?.confirmar_pedido_web;
  }

  async rechazar(id: string, branchId: string, motivo: string | null) {
    const { count } = await prisma.webOrder.updateMany({
      where: { id, branchId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectedReason: motivo, updatedAt: new Date() },
    });
    return count;
  }
}
