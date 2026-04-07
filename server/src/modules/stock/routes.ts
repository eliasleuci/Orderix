import { Router } from 'express';
import { StockController } from './controller';
import { authMiddleware } from '../../common/middlewares/authMiddleware';
import { roleMiddleware } from '../../common/middlewares/roleMiddleware';
import { validate } from '../../common/middlewares/validationMiddleware';
import { z } from 'zod';

const router = Router();
const stockController = new StockController();

const createIngredientSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    unit: z.string().min(1),
    stock: z.number().min(0),
    minStock: z.number().min(0),
    categoryId: z.string().optional()
  })
});

const updateStockSchema = z.object({
  body: z.object({
    stock: z.number().min(0),
    reason: z.string().optional()
  })
});

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1)
  })
});

router.use(authMiddleware);

router.get('/', stockController.getStock);
router.get('/movements', stockController.getMovements);
router.get('/report', stockController.getReport);
router.get('/categories', stockController.getCategories);

router.post(
  '/',
  roleMiddleware(['ADMIN']),
  validate(createIngredientSchema),
  stockController.create
);
router.post(
  '/categories',
  roleMiddleware(['ADMIN']),
  validate(createCategorySchema),
  stockController.createCategory
);

router.patch(
  '/:id',
  roleMiddleware(['ADMIN']),
  validate(updateStockSchema),
  stockController.update
);

router.delete(
  '/:id',
  roleMiddleware(['ADMIN']),
  stockController.delete
);

export default router;
