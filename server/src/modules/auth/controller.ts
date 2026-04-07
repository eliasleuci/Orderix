import { Request, Response, NextFunction } from 'express';
import { AuthService } from './service';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const data = await authService.login(email, password);

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async exchangeToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { supabaseToken } = req.body;
      
      if (!supabaseToken) {
        res.status(400).json({
          status: 'error',
          message: 'supabaseToken is required'
        });
        return;
      }

      const data = await authService.exchangeToken(supabaseToken);

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}
