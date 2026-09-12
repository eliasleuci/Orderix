import { Request, Response, NextFunction } from 'express';
import { CashService } from './service';

const cashService = new CashService();

export class CashController {
  getActual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await cashService.getActual(req.user?.branchId);
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  abrir = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caja = await cashService.abrir(
        req.user?.branchId,
        req.user!.id,
        req.body.montoInicial,
        req.body.notas
      );
      res.status(201).json({ status: 'success', data: { caja } });
    } catch (error) {
      next(error);
    }
  };

  cerrar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await cashService.cerrar(
        req.user?.branchId,
        req.user!.id,
        req.body.montoContado,
        req.body.notas
      );
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  corregir = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caja = await cashService.corregir(
        req.user?.branchId,
        req.params.id as string,
        req.body.montoContado,
        req.body.notas
      );
      res.status(200).json({ status: 'success', data: { caja } });
    } catch (error) {
      next(error);
    }
  };

  eliminar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cashService.eliminar(req.user?.branchId, req.params.id as string);
      res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  };

  getHistorial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const turnos = await cashService.getHistorial(req.user?.branchId);
      res.status(200).json({ status: 'success', results: turnos.length, data: { turnos } });
    } catch (error) {
      next(error);
    }
  };
}
