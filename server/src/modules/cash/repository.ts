import { prisma } from '../../config/database';

const conUsuarios = {
  openedBy: { select: { id: true, name: true, email: true } },
  closedBy: { select: { id: true, name: true, email: true } },
};

export class CashRepository {
  async findOpenByBranch(branchId: string) {
    return prisma.cashSession.findFirst({
      where: { branchId, status: 'OPEN' },
      include: conUsuarios,
    });
  }

  async findById(id: string) {
    return prisma.cashSession.findFirst({ where: { id }, include: conUsuarios });
  }

  async open(data: {
    branchId: string;
    openedById: string;
    openingAmount: number;
    openingNotes?: string | null;
  }) {
    // `as any` porque falta tenantId: lo inyecta la extensión de prisma con el
    // del contexto de la request, igual que en el resto de los repositorios.
    return prisma.cashSession.create({
      data: {
        branchId: data.branchId,
        openedById: data.openedById,
        openingAmount: data.openingAmount,
        openingNotes: data.openingNotes ?? null,
        status: 'OPEN',
      } as any,
      include: conUsuarios,
    });
  }

  async close(
    id: string,
    data: {
      closedById: string;
      countedAmount: number;
      cashSales: number;
      expectedAmount: number;
      difference: number;
      closingNotes?: string | null;
    }
  ) {
    return prisma.cashSession.update({
      where: { id },
      data: { ...data, closingNotes: data.closingNotes ?? null, status: 'CLOSED', closedAt: new Date() },
      include: conUsuarios,
    });
  }

  async findHistory(branchId: string, limit: number) {
    return prisma.cashSession.findMany({
      where: { branchId, status: 'CLOSED' },
      include: conUsuarios,
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Ventas de la sucursal en la ventana del turno, agrupadas por forma de pago.
   * Se usa `createdAt` a propósito, para que los números coincidan con los del
   * Financiero y los reportes: si cada pantalla contara distinto, cuadrar la
   * caja sería imposible.
   */
  async sumarVentas(branchId: string, desde: Date, hasta: Date) {
    return prisma.order.groupBy({
      by: ['payment_method'],
      where: { branchId, createdAt: { gte: desde, lte: hasta } },
      _sum: { total: true },
      _count: { _all: true },
    });
  }

  /** Mesas abiertas: ya se consumió pero la plata todavía no entró al cajón. */
  async contarSinCobrar(branchId: string, desde: Date, hasta: Date) {
    return prisma.order.aggregate({
      where: {
        branchId,
        payment_method: 'UNPAID',
        createdAt: { gte: desde, lte: hasta },
      },
      _sum: { total: true },
      _count: { _all: true },
    });
  }
}
