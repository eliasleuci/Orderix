import { Request, Response, NextFunction } from 'express';
import { WebshopService } from './service';

const webshopService = new WebshopService();

const sucursalDeQuery = (req: Request) =>
  typeof req.query.sucursal === 'string' ? req.query.sucursal : undefined;

export class WebshopController {
  getVidriera = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await webshopService.getVidriera(req.params.slug as string, sucursalDeQuery(req));
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  crearPedido = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pedido, repetido } = await webshopService.crearPedido(
        req.params.slug as string,
        sucursalDeQuery(req),
        req.body,
        req.ip
      );
      // 200 y no 201 cuando es un reenvío: no se creó nada nuevo.
      res.status(repetido ? 200 : 201).json({ status: 'success', data: { pedido, repetido } });
    } catch (error) {
      next(error);
    }
  };

  getBandeja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pedidos = await webshopService.getBandeja(
        req.user?.branchId,
        req.query.historial === 'true'
      );
      res.status(200).json({ status: 'success', results: pedidos.length, data: { pedidos } });
    } catch (error) {
      next(error);
    }
  };

  confirmar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await webshopService.confirmar(
        req.user?.branchId,
        req.user!.id,
        req.params.id as string,
        Boolean(req.body?.aceptarCambioDePrecio)
      );
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  rechazar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await webshopService.rechazar(req.user?.branchId, req.params.id as string, req.body?.motivo);
      res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  };
}
