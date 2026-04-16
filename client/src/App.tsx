import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { cn } from './lib/utils';
import Sidebar from './layouts/Sidebar';

const LandingPage = lazy(() => import('./modules/landing/LandingPage'));
const LoginPage = lazy(() => import('./modules/auth/LoginPage'));
const POSPage = lazy(() => import('./modules/pos/POSPage'));
const KitchenPage = lazy(() => import('./modules/kitchen/KitchenPage'));
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage'));
const FinancialPage = lazy(() => import('./modules/financial/FinancialPage'));
const CatalogPage = lazy(() => import('./modules/catalog/CatalogPage'));
const TablesPage = lazy(() => import('./modules/tables/TablesPage'));
const StockPage = lazy(() => import('./modules/stock/StockPage'));
const DebugPage = lazy(() => import('./modules/debug/DebugPage'));

// Superadmin
const SuperAdminLayout = lazy(() => import('./layouts/SuperAdminLayout'));
const TenantsPage = lazy(() => import('./modules/superadmin/TenantsPage'));

const PageLoader = () => (
  <div className="min-h-screen bg-surface-base flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Componente para manejar redirecciones de Hash (links viejos)
const HashRedirectHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    // Si la URL contiene un hash como #/login, lo enviamos al path real /login
    if (window.location.hash.includes('/login')) {
      navigate('/login', { replace: true });
    } else if (window.location.hash === '#/' || window.location.hash === '#') {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  return null;
};

// Componente para manejar el Layout condicional
const AppContent = () => {
  const { user, branchId, loading, setUser, role } = useAuthStore();
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

  const isLandingRoute = location.pathname === '/';
  const isKitchenRoute = location.pathname === '/kitchen';
  // Ocultamos el sidebar si es Kitchen (y rol cocina/sin usuario) o si es la Landing Page
  const shouldHideSidebar = (isKitchenRoute && (role === 'KITCHEN' || !user)) || isLandingRoute;
  
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Si es SuperAdmin usamos el layout propio de super admin y sus rutas
  if (isSuperAdmin && user) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#0A0A0B] text-white transition-colors duration-300">
        <HashRedirectHandler />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/superadmin/*" element={<SuperAdminLayout />}>
              <Route index element={<TenantsPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="*" element={<Navigate to="/superadmin/tenants" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/superadmin/tenants" replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base text-text-primary transition-colors duration-300">
      <HashRedirectHandler />
      {user && branchId && !shouldHideSidebar && <Sidebar />}
      <main className={cn("flex-1 overflow-auto bg-surface-base relative", (shouldHideSidebar || !branchId) && "w-full")}>
        <Suspense fallback={<PageLoader />}>
          {(!user || !branchId) ? (
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/kitchen" element={<KitchenPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Navigate to="/pos" replace />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/kitchen" element={<KitchenPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/financial" element={<FinancialPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/tables" element={<TablesPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/debug" element={<DebugPage />} />
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
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
