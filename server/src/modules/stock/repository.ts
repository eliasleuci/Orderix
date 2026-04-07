import { prisma } from '../../config/database';

type MovementType = 'ADD' | 'REMOVE' | 'ADJUST' | 'INITIAL';

export class StockRepository {
  async findByBranch(branchId: string) {
    return prisma.ingredient.findMany({
      where: { branchId, deletedAt: null },
      include: { category: true },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string) {
    return prisma.ingredient.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    branchId: string;
    categoryId?: string;
  }) {
    return prisma.ingredient.create({
      data: {
        name: data.name,
        unit: data.unit,
        stock: data.stock,
        minStock: data.minStock,
        branchId: data.branchId,
        categoryId: data.categoryId || null
      }
    });
  }

  async delete(id: string, userId?: string) {
    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) throw new Error('Ingredient not found');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ingredient.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          userId: userId || null,
          type: 'ADJUST',
          quantity: 0,
          stockBefore: ingredient.stock,
          stockAfter: 0,
          reason: 'Ingrediente eliminado'
        }
      });

      return updated;
    });
  }

  async updateStock(id: string, newStock: number, userId?: string, type: MovementType = 'ADJUST', reason?: string) {
    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) throw new Error('Ingredient not found');

    const stockBefore = ingredient.stock;
    const quantity = newStock - stockBefore;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ingredient.update({
        where: { id },
        data: { stock: newStock }
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          userId: userId || null,
          type,
          quantity,
          stockBefore,
          stockAfter: newStock,
          reason: reason || null
        }
      });

      return updated;
    });
  }

  async getCategories() {
    return prisma.ingredientCategory.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createCategory(name: string) {
    return prisma.ingredientCategory.create({
      data: { name: name.trim().toUpperCase() }
    });
  }

  async getStockMovements(branchId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      ingredient: { branchId }
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return prisma.stockMovement.findMany({
      where,
      include: {
        ingredient: true,
        user: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async getStockReport(branchId: string) {
    const ingredients = await prisma.ingredient.findMany({
      where: { branchId, deletedAt: null },
      select: {
        id: true,
        name: true,
        unit: true,
        stock: true,
        minStock: true
      }
    });

    const total = ingredients.length;
    const okCount = ingredients.filter(i => i.stock > i.minStock).length;
    const lowCount = ingredients.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
    const outCount = ingredients.filter(i => i.stock === 0).length;

    const lowStockItems = ingredients
      .filter(i => i.stock <= i.minStock)
      .sort((a, b) => a.stock - b.minStock - (b.stock - b.minStock))
      .slice(0, 10)
      .map(i => ({
        name: i.name,
        stock: i.stock,
        minStock: i.minStock,
        deficit: Math.max(0, i.minStock - i.stock),
        unit: i.unit,
        status: i.stock === 0 ? 'out' : 'low'
      }));

    const movements = await prisma.stockMovement.groupBy({
      by: ['type'],
      where: {
        ingredient: { branchId }
      },
      _count: true,
      _sum: { quantity: true }
    });

    const consumptionByType = movements.reduce((acc: Record<string, { count: number; totalQuantity: number }>, m: { type: string; _count: number; _sum: { quantity: number | null } }) => {
      acc[m.type] = {
        count: m._count,
        totalQuantity: Math.abs(m._sum.quantity || 0)
      };
      return acc;
    }, {});

    return {
      summary: { total, okCount, lowCount, outCount },
      lowStockItems,
      consumptionByType
    };
  }
}
