import { Router } from 'express';
import { OrderController } from './controller';
import { authMiddleware } from '../../common/middlewares/authMiddleware';
import { roleMiddleware } from '../../common/middlewares/roleMiddleware';
import { validate } from '../../common/middlewares/validationMiddleware';
import { z } from 'zod';
import { uuid } from '../../common/utils/uuid';

const router = Router();
const orderController = new OrderController();

const createOrderSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productId: uuid('Producto inválido'),
        quantity: z.number().int().positive(),
        price: z.number().positive().optional() 
      })
    ).min(1)
  })
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
  })
});

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware(['CASHIER', 'ADMIN']),
  validate(createOrderSchema),
  orderController.create
);

router.get(
  '/',
  roleMiddleware(['CASHIER', 'ADMIN', 'KITCHEN']),
  orderController.getAll
);

router.patch(
  '/:id/status',
  roleMiddleware(['CASHIER', 'ADMIN', 'KITCHEN']),
  validate(updateStatusSchema),
  orderController.updateStatus
);

export default router;