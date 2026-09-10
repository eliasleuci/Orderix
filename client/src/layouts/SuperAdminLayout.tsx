import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';
import { AppWindow, Building2, CreditCard, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';

const superAdminNav = [
  { id: 'clientes', label: 'Clientes', icon: Building2, path: '/superadmin/clientes' },
  { id: 'facturacion', label: 'Facturación', icon: CreditCard, path: '/superadmin/facturacion' },
];

const SuperAdminLayout: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0B] text-white">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-72 bg-white/5 border-r border-white/10 flex flex-col backdrop-blur-2xl"
      >
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <AppWindow className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none">ORDERIX</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Superadmin</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-2">
          <div className="mb-6 px-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Menú Principal</p>
          </div>
          {superAdminNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative group",
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sa-active-pill" 
                    className="absolute inset-0 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl" 
                  />
                )}
                <Icon size={20} className={isActive ? "text-indigo-400 relative z-10" : "group-hover:text-indigo-400 transition-colors relative z-10"} />
                <span className="font-bold text-sm tracking-wide relative z-10">{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="p-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 mb-4">
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-white truncate">{user?.email}</span>
              <span className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Acceso Root</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            fullWidth 
            onClick={handleSignOut}
            className="text-white/50 hover:text-red-400 hover:bg-red-400/10 justify-start"
            leftIcon={<LogOut size={18} />}
          >
            Cerrar Sesión
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_50%)] pointer-events-none" />
        <div className="p-8 pb-32">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;
