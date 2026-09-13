import { basePrisma, prisma } from '../../config/database';

/** Lo que el cliente ve y lo que el local cobra: nada de datos internos. */
const PRODUCTO_PUBLICO = {
  id: true,
  name: true,
  description: true,
  price: true,
  // La imagen NO se trae acá: está guardada como data URL en base64 y pesa
  // cientos de KB por producto. Embebida en este JSON la carta llegaba a
  // pesar 12 MB y en un celular tardaba una eternidad en abrir. Se sirve
  // aparte, por /imagen/:productId, y acá sólo viaja su hash para versionar
  // la caché (md5 lo calcula Postgres: el base64 nunca sale de la base).
  category: { select: { id: true, name: true, displayOrder: true, isActive: true, showInCarta: true } },
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
   * Un hash corto de cada imagen, para colgárselo a la URL. Cambia sola cuando
   * el dueño sube otra foto, así la respuesta puede cachearse para siempre sin
   * que nadie quede viendo la imagen vieja.
   */
  async findImageVersions(branchId: string): Promise<Array<{ id: string; v: string }>> {
    return prisma.$queryRaw`
      SELECT id::text AS id, substring(md5(image_url), 1, 10) AS v
        FROM products
       WHERE branch_id = ${branchId}::uuid
         AND is_active = true
         AND image_url IS NOT NULL
    `;
  }

  /** Lo mismo para las categorías, que se guardan por local y no por sucursal. */
  async findCategoryImageVersions(tenantId: string): Promise<Array<{ id: string; v: string }>> {
    return prisma.$queryRaw`
      SELECT id::text AS id, substring(md5(image_url), 1, 10) AS v
        FROM categories
       WHERE tenant_id = ${tenantId}::uuid
         AND image_url IS NOT NULL
    `;
  }

  /** La imagen de un solo producto, ya acotada a la sucursal que la pide. */
  async findProductImage(branchId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, branchId, isActive: true },
      select: { image: true },
    });
  }

  async findCategoryImage(categoryId: string) {
    return prisma.category.findFirst({
      where: { id: categoryId },
      select: { imageUrl: true },
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
