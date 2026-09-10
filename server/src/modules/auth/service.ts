import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthRepository } from './repository';
import { AppError } from '../../common/exceptions/AppError';

const authRepository = new AuthRepository();

// Sin fallback a 'secret': firmar con un secreto adivinable permitiría que
// cualquiera se emita un token con role SUPER_ADMIN.
const requireJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET no está configurada en el servidor', 500);
  }
  return secret;
};

export class AuthService {
  async login(email: string, pass: string) {
  const user = await authRepository.findByEmail(email);

  if (!user || !user.password) {
    throw new AppError('Incorrect email or password', 401);
  }

  const isMatch = await bcrypt.compare(pass, user.password);

  if (!isMatch) {
    throw new AppError('Incorrect email or password', 401);
  }

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        branchId: user.branchId,
        tenantId: user.tenantId
      },
      requireJwtSecret(),
      { expiresIn: '1d' }
    );

    return { 
      token, 
      user: { 
        id: user.id, 
        name: user.full_name || user.name, 
        role: user.role, 
        tenantId: user.tenantId,
        branch: user.branchId 
      } 
    };
  }

  async exchangeToken(supabaseToken: string) {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseToken);

    if (authError || !user) {
      throw new AppError('Invalid Supabase token', 401);
    }

    const profile = await authRepository.findByEmail(user.email || '');

    const token = jwt.sign(
      { 
        id: user.id, 
        role: profile?.role || 'USER', 
        branchId: profile?.branchId || null,
        tenantId: profile?.tenantId || null
      },
      requireJwtSecret(),
      { expiresIn: '1d' }
    );

    return { 
      token, 
      user: { 
        id: user.id, 
        email: user.email,
        role: profile?.role || 'USER',
        tenantId: profile?.tenantId
      } 
    };
  }
}