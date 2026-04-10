import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { LogIn, Store, ShieldCheck, Mail, Lock, ChefHat, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ANIMATIONS } from '../../lib/motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Toast from '../../components/Toast';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'LOGIN' | 'BRANCH_SELECTION'>('LOGIN');
  const [branches, setBranches] = useState<any[]>([]);
  
  const { user, setUser, setBranchId, setTenantId, branchId } = useAuthStore();

  const loadBranches = async (tid: string) => {
    setLoading(true);
    const { data } = await authService.getTenantBranches(tid);
    setBranches(data || []);
    setLoading(false);
    setView('BRANCH_SELECTION');
  };

  // If already logged in but no branch, go straight to selection
  useEffect(() => {
    if (user && !branchId) {
      authService.getProfile(user.id).then(({ data: profile }) => {
        if (profile?.tenant_id) {
          loadBranches(profile.tenant_id);
          setTenantId(profile.tenant_id);
        }
      });
    }
  }, [user, branchId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await authService.signIn(email, password);

    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    if (data?.user) {
      const { data: profile } = await authService.getProfile(data.user.id);
      
      const userRole = profile?.role || 'CASHIER';
      const myTenantId = profile?.tenant_id;
      
      setUser(data.user, data.session, userRole);

      if (myTenantId) {
        setTenantId(myTenantId);
        await loadBranches(myTenantId);
      } else {
        setError('No se pudo encontrar el Tenant asociado a este usuario.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6 relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.05),transparent_70%)] pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />

      <motion.div 
        {...ANIMATIONS.fadeInUp}
        className="w-full max-w-lg z-10"
      >
        <Card 
          variant="solid" 
          padding="large" 
          className="border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
        >
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-32 h-32 mx-auto mb-8 relative rounded-[1.5rem] overflow-hidden shadow-2xl shadow-primary/20"
            >
              <img src="icono.ico" alt="Orderix Logo" className="w-full h-full object-cover" />
            </motion.div>
            
            <h1 className="text-4xl font-black tracking-tighter text-text-primary uppercase leading-none">
              Orderix
            </h1>
            <p className="text-text-muted font-bold mt-2 uppercase tracking-[0.3em] text-xs">
              Staff Access
            </p>
          </div>

          {view === 'LOGIN' ? (
            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-5">
                <Input
                  label="Correo Electrónico"
                  type="email"
                  placeholder="staff@hamburguer.com"
                  icon={<Mail size={20} />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock size={20} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                isLoading={loading}
                fullWidth
                size="lg"
                className="mt-4"
                leftIcon={<LogIn size={20} />}
              >
                Entrar al Sistema
              </Button>
            </form>
          ) : (
            <motion.div {...ANIMATIONS.fadeIn} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mx-auto mb-3">
                  <Store size={24} className="text-primary" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Seleccionar Sucursal</h3>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                  Estás autenticado como {user?.email}
                </p>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {branches.length === 0 && !loading ? (
                  <div className="text-center py-8 opacity-40">
                    <p className="text-xs font-bold uppercase tracking-widest">No hay sucursales disponibles</p>
                  </div>
                ) : loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 bg-surface-elevated/50 rounded-2xl border border-white/5 animate-pulse" />
                  ))
                ) : (
                  branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => setBranchId(branch.id)}
                      className="w-full text-left p-5 rounded-2xl bg-surface-elevated/50 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-center justify-between"
                    >
                      <div>
                        <p className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">
                          {branch.name}
                        </p>
                        <p className="text-[10px] text-text-muted font-bold mt-1">
                          {branch.location || 'Sin ubicación registrada'}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-white/10 group-hover:text-primary transition-colors" />
                    </button>
                  ))
                )}
              </div>

              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  useAuthStore.getState().signOut();
                  setView('LOGIN');
                }}
                className="text-xs uppercase tracking-[0.2em] font-black opacity-60 hover:opacity-100"
              >
                Cerrar Sesión / Cambiar Usuario
              </Button>
            </motion.div>
          )}

          <footer className="mt-12 pt-8 border-t border-border-subtle flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                Sistemas Verificados
              </span>
            </div>
          </footer>
        </Card>

        <div className="text-center text-text-muted text-[10px] font-black uppercase tracking-widest opacity-50 relative z-20">
          Orderix POS
        </div>
      </motion.div>

      {/* TOAST SYSTEM FOR ERRORS */}
      <Toast 
        message={error}
        type="error"
        isVisible={!!error}
        onClose={() => setError('')}
      />
    </div>
  );
};

export default LoginPage;
