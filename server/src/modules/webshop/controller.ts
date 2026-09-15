import { Request, Response, NextFunction } from 'express';
import { WebshopService } from './service';

const webshopService = new WebshopService();

const sucursalDeQuery = (req: Request) =>
  typeof req.query.sucursal === 'string' ? req.query.sucursal : undefined;

export class WebshopController {
  getVidriera = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const modo = req.query.modo === 'carta' ? 'carta' : 'pedidos';
      const data = await webshopService.getVidriera(req.params.slug as string, sucursalDeQuery(req), modo);
      // Corta, y con stale-while-revalidate: el menú no cambia segundo a
      // segundo, así que un cliente reabriendo la carta (o un CDN por delante)
      // puede servir esto sin volver a pegarle a la base cada vez.
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=300');
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  getImagen = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tipo = req.params.tipo === 'categoria' ? 'categoria' : 'producto';
      const img = await webshopService.getImagen(
        req.params.slug as string,
        sucursalDeQuery(req),
        tipo,
        req.params.id as string
      );

      if ('redirigirA' in img) return res.redirect(302, img.redirigirA);

      // La URL lleva el hash del contenido, así que esta respuesta nunca deja
      // de ser válida: si el dueño cambia la foto, cambia la URL.
      res.setHeader('Content-Type', img.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      // helmet marca todo como same-origin: la foto de una carta pública tiene
      // que poder cargarse igual desde el front, que en desarrollo corre en
      // otro puerto.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.status(200).end(img.contenido);
    } catch (error) {
      return next(error);
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
