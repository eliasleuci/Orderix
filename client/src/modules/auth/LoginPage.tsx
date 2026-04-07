import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { LogIn, Store, ShieldCheck, Mail, Lock, ChefHat } from 'lucide-react';
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
  
  const { setUser, setBranchId } = useAuthStore();

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
      // Obtenemos el perfil extendido (rol y sucursal)
      const { data: profile } = await authService.getProfile(data.user.id);
      
      const userRole = profile?.role || 'CASHIER';
      const myBranchId = profile?.branch_id || 'b1111111-1111-1111-1111-111111111111';
      
      setUser(data.user, data.session, userRole);
      setBranchId(myBranchId);
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

              <div className="space-y-2">
                <label className="block text-xs font-black text-text-muted uppercase tracking-widest pl-2">
                  Ubicación de Sucursal
                </label>
                <div className="relative group">
                  <Store className="absolute left-6 top-1/2 -translate-y-1/2 text-primary" size={20} />
                  <div className="w-full bg-surface-elevated/50 border border-primary/30 rounded-2xl py-0 pl-14 pr-6 text-text-primary font-bold h-14 flex items-center shadow-inner cursor-default">
                    La Calera, Córdoba, Argentina 🇦🇷
                  </div>
                </div>
              </div>
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
            
            <div className="pt-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                size="md"
                onClick={() => {
                  setBranchId('b1111111-1111-1111-1111-111111111111');
                  window.location.href = '/kitchen';
                }}
                className="bg-primary/5 border-primary/10 hover:bg-primary/10 text-primary"
                leftIcon={<ChefHat size={20} className="text-primary" />}
              >
                Modo Cocina (Acceso Rápido)
              </Button>
            </div>
          </form>

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
