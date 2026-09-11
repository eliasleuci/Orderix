import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'KITCHEN' | null;
  branchId: string | null;
  tenantId: string | null;
  loading: boolean;
  setUser: (user: User | null, session: Session | null, role?: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER' | 'KITCHEN' | null) => void;
  setBranchId: (id: string | null) => void;
  setTenantId: (id: string | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, // Zustand persist will hydrate this
      session: null,
      role: null,
      branchId: null,
      tenantId: null,
      loading: true,
      setUser: (user, session, role) => set((state) => ({ 
        user, 
        session, 
        role: role !== undefined ? role : (user ? state.role : null), 
        loading: false 
      })),
      setBranchId: (id) => set({ branchId: id }),
      setTenantId: (id) => set({ tenantId: id }),
      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) { /* ignore in mock */ }
        // role incluido: zustand persiste el store en localStorage, así que si no
        // se limpia, el SUPER_ADMIN sobrevive al logout en ese navegador.
        set({ user: null, session: null, role: null, branchId: null, tenantId: null, loading: false });

        // Salida dura al login, en vez de dejarlo librado a que cada pantalla
        // navegue por su cuenta: al limpiar el usuario, React Router desmonta la
        // pantalla que disparó el logout y su navigate() puede quedar en el aire,
        // dejando al cliente en la landing. Además recargar descarta todo el
        // estado en memoria y evita que el botón "atrás" muestre la app.
        if (typeof window !== 'undefined') {
          window.location.replace('/login');
        }
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        useAuthStore.setState({ loading: false });
      },
    }
  )
);
