import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authService } from '../../services/authService';
import { ANIMATIONS } from '../../lib/motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const MIN_LARGO = 8;

type Estado = 'verificando' | 'listo' | 'sin-sesion' | 'hecho';

/**
 * Destino del link del mail de recuperación.
 *
 * Supabase deja los tokens en el hash de la URL y el cliente los canjea solo
 * (detectSessionInUrl viene activado). Mientras eso pasa mostramos "verificando";
 * si nunca llega una sesión, el link venció o ya se usó.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [estado, setEstado] = useState<Estado>('verificando');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let vivo = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (vivo && session) setEstado((e) => (e === 'hecho' ? e : 'listo'));
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!vivo) return;
      if (session) {
        setEstado((e) => (e === 'hecho' ? e : 'listo'));
      } else {
        // El canje del token puede tardar un instante; si no aparece, el link no sirve.
        setTimeout(() => {
          if (vivo) setEstado((e) => (e === 'verificando' ? 'sin-sesion' : e));
        }, 2500);
      }
    });

    return () => {
      vivo = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nueva.length < MIN_LARGO) {
      setError(`La contraseña debe tener al menos ${MIN_LARGO} caracteres`);
      return;
    }
    if (nueva !== repetir) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    const { error: err } = await authService.updatePassword(nueva);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }

    setEstado('hecho');
    // Se cierra la sesión de recuperación para que entre con la contraseña nueva.
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <motion.div {...ANIMATIONS.fadeInUp} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
            <KeyRound className="text-primary" size={30} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-text-primary">
            Nueva contraseña
          </h1>
        </div>

        <Card variant="solid">
          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-text-secondary text-sm">Verificando el link...</p>
            </div>
          )}

          {estado === 'sin-sesion' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <AlertTriangle className="text-danger" size={30} />
              <div>
                <p className="font-black text-text-primary">Este link ya no sirve</p>
                <p className="text-text-secondary text-sm mt-1">
                  Los links de recuperación vencen y se pueden usar una sola vez.
                  Pedí uno nuevo desde la pantalla de ingreso.
                </p>
              </div>
              <Button onClick={() => navigate('/login')}>Volver al ingreso</Button>
            </div>
          )}

          {estado === 'hecho' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <ShieldCheck className="text-success" size={30} />
              <div>
                <p className="font-black text-text-primary">Contraseña actualizada</p>
                <p className="text-text-secondary text-sm mt-1">
                  Te llevamos al ingreso para que entres con la nueva.
                </p>
              </div>
            </div>
          )}

          {estado === 'listo' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Contraseña nueva"
                type="password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                icon={<KeyRound size={18} />}
                autoComplete="new-password"
                minLength={MIN_LARGO}
                required
                autoFocus
              />
              <Input
                label="Repetir contraseña"
                type="password"
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                icon={<KeyRound size={18} />}
                autoComplete="new-password"
                errorMessage={error || undefined}
                required
              />
              <Button type="submit" isLoading={loading} fullWidth>
                Guardar contraseña
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
