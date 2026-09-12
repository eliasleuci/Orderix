import { CashRepository } from './repository';
import { AppError } from '../../common/exceptions/AppError';

const cashRepository = new CashRepository();

const aNumero = (v: unknown) => Number(v ?? 0);

/** Redondeo a dos decimales, para que no aparezca un descuadre de $0.0000001. */
const redondear = (n: number) => Math.round(n * 100) / 100;

const serializar = (s: any) => ({
  id: s.id,
  estado: s.status,
  montoInicial: aNumero(s.openingAmount),
  montoContado: s.countedAmount === null ? null : aNumero(s.countedAmount),
  ventasEfectivo: s.cashSales === null ? null : aNumero(s.cashSales),
  montoEsperado: s.expectedAmount === null ? null : aNumero(s.expectedAmount),
  diferencia: s.difference === null ? null : aNumero(s.difference),
  notasApertura: s.openingNotes,
  notasCierre: s.closingNotes,
  abiertaEn: s.openedAt,
  cerradaEn: s.closedAt,
  abiertaPor: s.openedBy?.name ?? s.openedBy?.email ?? null,
  cerradaPor: s.closedBy?.name ?? s.closedBy?.email ?? null,
});

export class CashService {
  private exigirSucursal(branchId?: string | null): string {
    if (!branchId) throw new AppError('El usuario no tiene una sucursal asignada', 400);
    return branchId;
  }

  async getActual(branchId?: string | null) {
    const sucursal = this.exigirSucursal(branchId);
    const abierta = await cashRepository.findOpenByBranch(sucursal);
    if (!abierta) return { caja: null, resumen: null };

    return { caja: serializar(abierta), resumen: await this.calcularResumen(sucursal, abierta.openedAt) };
  }

  /**
   * Cuánto debería haber en el cajón ahora mismo. Se recalcula en cada consulta
   * mientras el turno está abierto; recién al cerrar queda congelado.
   */
  private async calcularResumen(branchId: string, desde: Date) {
    const hasta = new Date();
    const [porMedio, sinCobrar] = await Promise.all([
      cashRepository.sumarVentas(branchId, desde, hasta),
      cashRepository.contarSinCobrar(branchId, desde, hasta),
    ]);

    let efectivo = 0;
    let electronico = 0;
    let cantidad = 0;

    for (const fila of porMedio) {
      const monto = aNumero(fila._sum.total);
      const medio = fila.payment_method;

      if (medio === 'UNPAID') continue;

      cantidad += fila._count._all;
      // Todo lo que no sea efectivo va al cajón virtual: así, si mañana se
      // agrega otra forma de pago, no queda silenciosamente fuera del total.
      if (medio === 'CASH') efectivo += monto;
      else electronico += monto;
    }

    return {
      ventasEfectivo: redondear(efectivo),
      ventasElectronicas: redondear(electronico),
      cantidadPedidos: cantidad,
      sinCobrar: {
        total: redondear(aNumero(sinCobrar._sum.total)),
        cantidad: sinCobrar._count._all,
      },
    };
  }

  async abrir(
    branchId: string | null | undefined,
    userId: string,
    montoInicial: number,
    notas?: string | null
  ) {
    const sucursal = this.exigirSucursal(branchId);

    const abierta = await cashRepository.findOpenByBranch(sucursal);
    if (abierta) throw new AppError('Ya hay una caja abierta en esta sucursal', 409);

    try {
      const caja = await cashRepository.open({
        branchId: sucursal,
        openedById: userId,
        openingAmount: montoInicial,
        openingNotes: notas,
      });
      return serializar(caja);
    } catch (e: any) {
      // El índice único parcial de la base es la última palabra: dos aperturas
      // simultáneas pasan el chequeo de arriba, pero acá una sola sobrevive.
      if (e?.code === 'P2002') {
        throw new AppError('Ya hay una caja abierta en esta sucursal', 409);
      }
      throw e;
    }
  }

  async cerrar(
    branchId: string | null | undefined,
    userId: string,
    montoContado: number,
    notas?: string | null
  ) {
    const sucursal = this.exigirSucursal(branchId);

    const abierta = await cashRepository.findOpenByBranch(sucursal);
    if (!abierta) throw new AppError('No hay ninguna caja abierta para cerrar', 409);

    const resumen = await this.calcularResumen(sucursal, abierta.openedAt);
    const esperado = redondear(aNumero(abierta.openingAmount) + resumen.ventasEfectivo);

    const cerrada = await cashRepository.close(abierta.id, {
      closedById: userId,
      countedAmount: montoContado,
      cashSales: resumen.ventasEfectivo,
      expectedAmount: esperado,
      difference: redondear(montoContado - esperado),
      closingNotes: notas,
    });

    return { caja: serializar(cerrada), resumen };
  }

  /**
   * El monto esperado queda como está: se calculó con las ventas del turno y
   * congelarlo es justamente el punto. Se recalcula la diferencia contra lo
   * que se corrige.
   */
  async corregir(
    branchId: string | null | undefined,
    id: string,
    montoContado: number,
    notas?: string | null
  ) {
    const sucursal = this.exigirSucursal(branchId);

    const turno = await cashRepository.findById(id);
    if (!turno || turno.branchId !== sucursal || turno.status !== 'CLOSED') {
      throw new AppError('No se encontró ese turno cerrado', 404);
    }

    const esperado = aNumero(turno.expectedAmount);
    const filas = await cashRepository.corregirCierre(id, sucursal, {
      countedAmount: montoContado,
      difference: redondear(montoContado - esperado),
      closingNotes: notas,
    });
    if (filas === 0) throw new AppError('No se pudo corregir el turno', 404);

    const actualizado = await cashRepository.findById(id);
    return serializar(actualizado);
  }

  async eliminar(branchId: string | null | undefined, id: string) {
    const sucursal = this.exigirSucursal(branchId);

    const filas = await cashRepository.eliminar(id, sucursal);
    // Un turno abierto no se borra: primero se cierra. Si no, la caja quedaría
    // sin turno en pleno servicio y sin registro de lo que pasó.
    if (filas === 0) throw new AppError('No se encontró ese turno cerrado', 404);
  }

  async getHistorial(branchId: string | null | undefined, limit = 30) {
    const sucursal = this.exigirSucursal(branchId);
    const turnos = await cashRepository.findHistory(sucursal, limit);
    return turnos.map(serializar);
  }
}
