import { Router } from 'express';
import { CashController } from './controller';
import { authMiddleware } from '../../common/middlewares/authMiddleware';
import { roleMiddleware } from '../../common/middlewares/roleMiddleware';
import { validate } from '../../common/middlewares/validationMiddleware';
import { abrirCajaSchema, cerrarCajaSchema } from './schemas';

const router = Router();
const cashController = new CashController();

router.use(authMiddleware);

// Abrir y cerrar es tarea de quien atiende la caja. Cocina queda afuera.
const deCaja = roleMiddleware(['ADMIN', 'CASHIER']);

router.get('/actual', deCaja, cashController.getActual);
router.post('/abrir', deCaja, validate(abrirCajaSchema), cashController.abrir);
router.post('/cerrar', deCaja, validate(cerrarCajaSchema), cashController.cerrar);

// El historial de arqueos muestra los descuadres de todos los turnos: es
// información del dueño, no de quien está atendiendo.
router.get('/historial', roleMiddleware(['ADMIN']), cashController.getHistorial);

export default router;
