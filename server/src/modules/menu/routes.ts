import { Router } from 'express';
import { MenuController } from './controller';
import { authMiddleware } from '../../common/middlewares/authMiddleware';

const router = Router();
const menuController = new MenuController();

// Sin authMiddleware: la carta se abre desde el QR, sin cuenta ni sesión.
// El prefijo /publico evita que un slug choque con las rutas del panel.
router.get('/publico/:slug', menuController.getPublicMenu);

router.get('/enlace', authMiddleware, menuController.getShareLink);

export default router;
