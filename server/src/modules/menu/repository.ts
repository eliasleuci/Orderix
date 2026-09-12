import { basePrisma, prisma } from '../../config/database';

export class MenuRepository {
  /**
   * El tenant se busca con basePrisma a propósito: todavía no hay tenant en el
   * contexto (la carta es pública, no pasa por authMiddleware), así que es la
   * única consulta que corre sin el filtro automático por tenantId.
   */
  async findTenantBySlug(slug: string) {
    return basePrisma.tenant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
  }

  async findTenantById(tenantId: string) {
    return basePrisma.tenant.findFirst({
      where: { id: tenantId },
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

  /** Sólo lo que puede ver un comensal: nombre, precio, foto y categoría. */
  async findMenuProducts(branchId: string) {
    return prisma.product.findMany({
      where: { branchId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        category: { select: { id: true, name: true } },
        // Sólo el nombre del ingrediente. Las cantidades de la receta son
        // información de costos del local y no tienen por qué salir al público.
        recipe: {
          select: { ingredient: { select: { name: true, is_active: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
