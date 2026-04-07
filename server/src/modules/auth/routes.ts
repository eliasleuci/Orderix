import { Router } from 'express';
import { AuthController } from './controller';
import { validate } from '../../common/middlewares/validationMiddleware';
import { z } from 'zod';

const router = Router();
const authController = new AuthController();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
});

const exchangeTokenSchema = z.object({
  body: z.object({
    supabaseToken: z.string()
  })
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/exchange-token', validate(exchangeTokenSchema), authController.exchangeToken);

export default router;
