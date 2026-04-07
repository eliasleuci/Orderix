import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { LayoutDashboard, Utensils, ChefHat, LogOut, Store, BookOpen, Sun, Moon, UtensilsCrossed, DollarSign, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const menuItems = [
    { path: '/pos', icon: <Utensils />, label: 'Ventas' },
    { path: '/kitchen', icon: <ChefHat />, label: 'Cocina' },
    { path: '/tables', icon: <UtensilsCrossed />, label: 'Mesas' },
    { path: '/catalog', icon: <BookOpen />, label: 'Catálogo' },
    { path: '/stock', icon: <Package />, label: 'Stock' },
    { path: '/dashboard', icon: <LayoutDashboard />, label: 'Panel' },
    { path: '/financial', icon: <DollarSign />, label: 'Financiero' },
  ];

  return (
    <aside className="w-24 bg-surface-base border-r border-border-subtle flex flex-col items-center py-8 justify-between relative z-50 transition-colors duration-300">
      <div className="space-y-10 flex flex-col items-center w-full">
        {/* LOGO AREA */}
        <div className="w-14 h-14 bg-primary/10 rounded-[1.2rem] flex items-center justify-center shadow-2xl border border-primary/20 mb-4 transition-transform hover:scale-110">
          <Store className="text-primary" size={28} />
        </div>

        {/* NAVIGATION */}
        <nav className="flex flex-col gap-8 w-full px-2">
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
                  "text-[9px] font-black uppercase tracking-[0.1em] transition-all",
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
      </div>

      {/* ACTIONS */}
      <div className="flex flex-col gap-4">
        {/* THEME TOGGLE */}
        <button 
          onClick={toggleTheme}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-text-muted hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          {theme === 'dark' ? (
            <Moon size={24} className="transition-transform group-hover:-rotate-12" />
          ) : (
            <Sun size={24} className="transition-transform group-hover:rotate-45" />
          )}
        </button>

        {/* SIGN OUT */}
        <button 
          onClick={signOut}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-text-muted hover:bg-danger/10 hover:text-danger transition-all border border-transparent hover:border-danger/20 group"
          title="Cerrar sesión"
        >
          <LogOut size={24} className="transition-transform group-hover:-translate-x-1" />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
