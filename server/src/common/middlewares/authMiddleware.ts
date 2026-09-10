import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppError } from '../exceptions/AppError';
import { getContext } from '../utils/context';
import { logger } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../../config/database';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(new AppError('No authenticated user', 401));

  try {
    let decoded: any = null;

    try {
      // First try local JWT from exchangeToken.
      // Sin fallback a 'secret': un secreto adivinable permitiría forjar un token
      // con role SUPER_ADMIN. Si no está configurado, se valida contra Supabase.
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET no configurado');
      decoded = jwt.verify(token, jwtSecret) as any;
    } catch {
      // If it fails, fallback to Supabase JWT verification
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (!error && user) {
          const profile = await prisma.user.findUnique({ where: { id: user.id } });
          if (profile) {
            decoded = {
              id: profile.id,
              role: profile.role,
              tenantId: profile.tenantId,
              branchId: profile.branchId
            };
          }
        }
      }
    }

    if (!decoded) {
      return next(new AppError('Invalid token', 401));
    }

    const store = getContext();

    if (store) {
      store.tenantId = decoded.tenantId;
      store.userId = decoded.id;
    }

    logger.info(`${req.method} ${req.url} | tenantId=${decoded.tenantId}`);

    res.on('finish', () => {
      if (store) {
        const duration = Date.now() - store.startTime;
        logger.info(`Request completed | method=${req.method} url=${req.url} status=${res.statusCode} durationMs=${duration}`);
      }
    });

    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError('Authentication parsing error', 401));
  }
};