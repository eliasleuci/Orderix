import { Request, Response, NextFunction } from 'express';
import { MenuService } from './service';

const menuService = new MenuService();

export class MenuController {
  getPublicMenu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sucursal = typeof req.query.sucursal === 'string' ? req.query.sucursal : undefined;
      const menu = await menuService.getPublicMenu(req.params.slug as string, sucursal);

      res.status(200).json({ status: 'success', data: menu });
    } catch (error) {
      next(error);
    }
  };

  getShareLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await menuService.getShareLink(req.user?.tenantId);
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };
}
