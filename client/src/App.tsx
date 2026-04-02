import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { cn } from './lib/utils';
import LoginPage from './modules/auth/LoginPage';
import POSPage from './modules/pos/POSPage';
import KitchenPage from './modules/kitchen/KitchenPage';
import DashboardPage from './modules/dashboard/DashboardPage';
import FinancialPage from './modules/financial/FinancialPage';
import CatalogPage from './modules/catalog/CatalogPage';
import TablesPage from './modules/tables/TablesPage';
import Sidebar from './layouts/Sidebar';

// Componente para manejar el Layout condicional
const AppContent = () => {
  const { user, loading, setUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const location = useLocation();

  useEffect(() => {
    // Aplicar clase de tema al root
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null, session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null, session);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isKitchenRoute = location.pathname === '/kitchen';
  // Solo ocultamos el sidebar si estamos en cocina Y el rol es KITCHEN o no hay usuario
  const shouldHideSidebar = isKitchenRoute && (role === 'KITCHEN' || !user);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base text-text-primary transition-colors duration-300">
      {user && !shouldHideSidebar && <Sidebar />}
      <main className={cn("flex-1 overflow-auto bg-surface-base relative", shouldHideSidebar && "w-full")}>
        {!user ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/kitchen" element={<KitchenPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/pos" element={<POSPage />} />
            <Route path="/kitchen" element={<KitchenPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/financial" element={<FinancialPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
