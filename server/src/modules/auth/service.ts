import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './repository';
import { AppError } from '../../common/exceptions/AppError';

const authRepository = new AuthRepository();

export class AuthService {
  async login(email: string, pass: string) {
    const user = await authRepository.findByEmail(email);

    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, branchId: user.branchId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return { token, user: { id: user.id, name: user.name, role: user.role, branch: user.branch } };
  }

  async exchangeToken(supabaseToken: string) {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseToken);

    if (authError || !user) {
      throw new AppError('Invalid Supabase token', 401);
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single();

    let role = existingProfile?.role || 'CASHIER';
    let branchId = existingProfile?.branch_id || 'b1111111-1111-1111-1111-111111111111';

    if (!existingProfile) {
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          role: role,
          branch_id: branchId
        });
      
      if (createError) {
        console.error('Failed to create profile:', createError);
      }
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        role, 
        branchId 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return { 
      token, 
      user: { 
        id: user.id, 
        name: user.email?.split('@')[0] || 'User',
        role, 
        branchId 
      } 
    };
  }
}
