import { Router } from 'express';
import { WebshopController } from './controller';
import { authMiddleware } from '../../common/middlewares/authMiddleware';
import { roleMiddleware } from '../../common/middlewares/roleMiddleware';
import { validate } from '../../common/middlewares/validationMiddleware';
import { crearPedidoSchema, confirmarSchema, rechazarSchema } from './schemas';

const router = Router();
const webshopController = new WebshopController();

// --- Público: lo abre un cliente desde el link, sin cuenta ni sesión. ---
// El prefijo /publico evita que un slug choque con las rutas del panel.
router.get('/publico/:slug', webshopController.getVidriera);
router.post('/publico/:slug/pedido', validate(crearPedidoSchema), webshopController.crearPedido);

// --- Panel ---
router.use(authMiddleware);

// Quien atiende necesita poder confirmar un pedido que entra: esperar al dueño
// para empezar a cocinar no es viable en pleno servicio.
const deMostrador = roleMiddleware(['ADMIN', 'CASHIER']);

router.get('/pedidos', deMostrador, webshopController.getBandeja);
router.post('/pedidos/:id/confirmar', deMostrador, validate(confirmarSchema), webshopController.confirmar);
router.post('/pedidos/:id/rechazar', deMostrador, validate(rechazarSchema), webshopController.rechazar);

export default router;
