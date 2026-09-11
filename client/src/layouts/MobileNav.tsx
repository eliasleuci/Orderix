import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Utensils, ChefHat, LogOut, BookOpen, Sun, Moon,
  UtensilsCrossed, DollarSign, Package, KeyRound, MoreHorizontal, X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { cn } from '../lib/utils';
import ChangePasswordModal from '../modules/account/ChangePasswordModal';
import Toast from '../components/Toast';

/**
 * Navegación para celular: barra fija abajo, donde llega el pulgar.
 *
 * El sidebar de escritorio ocupa 96px fijos, casi un cuarto del ancho de un
 * teléfono. Acá quedan los 4 accesos de uso diario y el resto se agrupa en un
 * panel que sube desde abajo, para no amontonar 7 íconos en 390px.
 */

const PRINCIPALES = [
  { path: '/pos', icon: Utensils, label: 'Ventas' },
  { path: '/tables', icon: UtensilsCrossed, label: 'Mesas' },
  { path: '/kitchen', icon: ChefHat, label: 'Cocina' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Panel' },
];

const SECUNDARIOS = [
  { path: '/catalog', icon: BookOpen, label: 'Catálogo' },
  { path: '/stock', icon: Package, label: 'Stock' },
  { path: '/financial', icon: DollarSign, label: 'Financiero' },
];

const MobileNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [cambiarClave, setCambiarClave] = useState(false);
  const [aviso, setAviso] = useState('');

  const enSecundarios = SECUNDARIOS.some((i) => location.pathname === i.path);

  const cerrarYNavegar = (path: string) => {
    setPanelAbierto(false);
    navigate(path);
  };

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-base/95 backdrop-blur-lg border-t border-border-subtle"
        // Deja libre la barra de gestos del teléfono para que no tape los botones.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {PRINCIPALES.map((item) => {
            const activo = location.pathname === item.path;
            const Icono = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative"
              >
                {activo && (
                  <motion.span
                    layoutId="mobile-nav-activo"
                    className="absolute top-0 h-0.5 w-10 bg-primary rounded-full"
                  />
                )}
                <Icono size={21} className={activo ? 'text-primary' : 'text-text-muted'} />
                <span
                  className={cn(
                    'text-[9px] font-black uppercase tracking-wider',
                    activo ? 'text-primary' : 'text-text-muted'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setPanelAbierto(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative"
          >
            {enSecundarios && (
              <span className="absolute top-0 h-0.5 w-10 bg-primary rounded-full" />
            )}
            <MoreHorizontal size={21} className={enSecundarios ? 'text-primary' : 'text-text-muted'} />
            <span
              className={cn(
                'text-[9px] font-black uppercase tracking-wider',
                enSecundarios ? 'text-primary' : 'text-text-muted'
              )}
            >
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* Panel con el resto de las secciones y las acciones de la cuenta */}
      <AnimatePresence>
        {panelAbierto && (
          <div className="lg:hidden fixed inset-0 z-[60]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelAbierto(false)}
              className="absolute inset-0 bg-black/60"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute bottom-0 inset-x-0 bg-surface-elevated rounded-t-3xl border-t border-border-subtle p-5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-black uppercase tracking-widest text-text-muted">
                  Más opciones
                </span>
                <button
                  onClick={() => setPanelAbierto(false)}
                  className="p-2 rounded-xl bg-white/5 text-text-muted"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {SECUNDARIOS.map((item) => {
                  const activo = location.pathname === item.path;
                  const Icono = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => cerrarYNavegar(item.path)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-colors',
                        activo
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-surface-base border-border-subtle text-text-secondary'
                      )}
                    >
                      <Icono size={22} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border-subtle pt-4 space-y-1">
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-text-secondary active:bg-white/5"
                >
                  {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  <span className="text-sm font-bold">
                    {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setPanelAbierto(false);
                    setCambiarClave(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-text-secondary active:bg-white/5"
                >
                  <KeyRound size={20} />
                  <span className="text-sm font-bold">Cambiar mi contraseña</span>
                </button>

                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-danger active:bg-danger/10"
                >
                  <LogOut size={20} />
                  <span className="text-sm font-bold">Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ChangePasswordModal
        isOpen={cambiarClave}
        onClose={() => setCambiarClave(false)}
        onDone={setAviso}
      />
      <Toast
        message={aviso}
        type="success"
        isVisible={Boolean(aviso)}
        onClose={() => setAviso('')}
      />
    </>
  );
};

export default MobileNav;
