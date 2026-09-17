import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, UI_SCALE_STEPS } from '../store/themeStore';
import { LayoutDashboard, Utensils, ChefHat, LogOut, Store, BookOpen, Sun, Moon, UtensilsCrossed, DollarSign, Package, KeyRound, Wallet, Bike, Globe, Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { puedeVer } from '../lib/permisos';
import ChangePasswordModal from '../modules/account/ChangePasswordModal';
import Toast from '../components/Toast';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut, role } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme, uiScale, setUiScale } = useThemeStore();
  const scaleIndex = UI_SCALE_STEPS.indexOf(uiScale);
  const [cambiarClave, setCambiarClave] = useState(false);
  const [aviso, setAviso] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Sólo los accesos que el rol tiene permitidos. El ruteo vuelve a chequearlo:
  // esconder el ícono no impide entrar escribiendo la dirección.
  const menuItems = [
    { path: '/pos', icon: <Utensils />, label: 'Ventas' },
    { path: '/kitchen', icon: <ChefHat />, label: 'Cocina' },
    { path: '/tables', icon: <UtensilsCrossed />, label: 'Mesas' },
    { path: '/catalog', icon: <BookOpen />, label: 'Catálogo' },
    { path: '/stock', icon: <Package />, label: 'Stock' },
    { path: '/dashboard', icon: <LayoutDashboard />, label: 'Panel' },
    { path: '/cash', icon: <Wallet />, label: 'Caja' },
    { path: '/pedidos-web', icon: <Globe />, label: 'Pedidos web' },
    { path: '/delivery', icon: <Bike />, label: 'Delivery' },
    { path: '/financial', icon: <DollarSign />, label: 'Financiero' },
  ].filter((item) => puedeVer(role, item.path));

  return (
    <aside className="hidden lg:flex w-24 bg-surface-base border-r border-border-subtle flex-col items-center py-6 relative z-50 transition-colors duration-300">
      {/* LOGO AREA */}
      <div className="w-14 h-14 bg-primary/10 rounded-[1.2rem] flex items-center justify-center shadow-2xl border border-primary/20 mb-6 shrink-0 transition-transform hover:scale-110">
        <Store className="text-primary" size={28} />
      </div>

      {/* NAVIGATION
          Scrollea sola en vez de empujar: con el menú completo los accesos de
          abajo (cerrar sesión, tema, contraseña) quedaban fuera de la pantalla
          y no había forma de llegar a ellos. */}
      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-none flex flex-col gap-5 w-full px-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className="group relative flex flex-col items-center gap-1.5"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border",
                  isActive 
                    ? 'bg-primary text-white shadow-xl border-primary/50' 
                    : 'text-text-muted hover:bg-primary/5 border-transparent hover:border-primary/10'
                )}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 24 })}
                </div>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-[0.1em] text-center leading-tight transition-all",
                  isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="active-indicator" 
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-primary rounded-l-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                  />
                )}
              </Link>
            );
          })}
      </nav>

      {/* ACTIONS */}
      <div className="flex flex-col gap-1.5 shrink-0 pt-4 mt-2 border-t border-border-subtle w-full items-center">
        {/* TAMAÑO DE INTERFAZ */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setUiScale(UI_SCALE_STEPS[Math.max(0, scaleIndex - 1)])}
            disabled={scaleIndex === 0}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted"
            title="Achicar interfaz"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setUiScale(UI_SCALE_STEPS[Math.min(UI_SCALE_STEPS.length - 1, scaleIndex + 1)])}
            disabled={scaleIndex === UI_SCALE_STEPS.length - 1}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted"
            title="Agrandar interfaz"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* THEME TOGGLE */}
        <button 
          onClick={toggleTheme}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          {theme === 'dark' ? (
            <Moon size={20} className="transition-transform group-hover:-rotate-12" />
          ) : (
            <Sun size={20} className="transition-transform group-hover:rotate-45" />
          )}
        </button>

        {/* MI CONTRASEÑA */}
        <button
          onClick={() => setCambiarClave(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          title="Cambiar mi contraseña"
        >
          <KeyRound size={20} className="transition-transform group-hover:rotate-12" />
        </button>

        {/* SIGN OUT */}
        <button 
          onClick={handleSignOut}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-text-muted hover:bg-danger/10 hover:text-danger transition-all border border-transparent hover:border-danger/20 group"
          title="Cerrar sesión"
        >
          <LogOut size={20} className="transition-transform group-hover:-translate-x-1" />
        </button>
      </div>

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
    </aside>
  );
};

export default Sidebar;
