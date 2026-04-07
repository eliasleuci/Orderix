import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { cn } from './lib/utils';
import Sidebar from './layouts/Sidebar';

const LoginPage = lazy(() => import('./modules/auth/LoginPage'));
const POSPage = lazy(() => import('./modules/pos/POSPage'));
const KitchenPage = lazy(() => import('./modules/kitchen/KitchenPage'));
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage'));
const FinancialPage = lazy(() => import('./modules/financial/FinancialPage'));
const CatalogPage = lazy(() => import('./modules/catalog/CatalogPage'));
const TablesPage = lazy(() => import('./modules/tables/TablesPage'));
const StockPage = lazy(() => import('./modules/stock/StockPage'));

const PageLoader = () => (
  <div className="min-h-screen bg-surface-base flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
              <Route path="/stock" element={<StockPage />} />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          )}
        </Suspense>
      </main>
    </div>
  );
};

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
