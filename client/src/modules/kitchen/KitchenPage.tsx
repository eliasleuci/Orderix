import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useAuthStore } from '../../store/authStore';
import { orderService } from '../../services/orderService';
import { Order, OrderStatus } from '../../types/domain';
import { ChefHat, Loader2, Signal, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ANIMATIONS } from '../../lib/motion';
import Toast from '../../components/Toast';
import OrderCard from './components/OrderCard';

const KitchenPage: React.FC = () => {
  const { branchId, setBranchId } = useAuthStore();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const playBell = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.volume = 0.5;
    }
    audioRef.current.play().catch(() => {});
  }, []);

  const memoizedOptions = useMemo(() => {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    return { startDate: yesterday.toISOString() };
  }, []);

  const handleNewOrder = useCallback((newOrder: Order) => {
    if (newOrder.status === 'PENDING') {
      playBell();
    }
  }, [playBell]);

  const { orders, loading, isConnected, lastUpdate, pendingCount, setOrders } = useOrders(branchId, memoizedOptions, handleNewOrder);

  const syncTimeDisplay = useMemo(() => {
    if (!lastUpdate) return 'Sincronizando...';
    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (seconds < 2) return 'Ahora';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  }, [lastUpdate]);

  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. BRANCH RECOVERY (For direct link access)
  useEffect(() => {
    if (!branchId) {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('branchId') || 'b1111111-1111-1111-1111-111111111111';
      setBranchId(id);
    }
  }, [branchId, setBranchId]);

  // 1. MEMOIZED STATUS HANDLER (with Optimistic Update)
  const handleStatusChange = useCallback(async (orderId: string, currentStatus: string) => {
    const nextStatus: OrderStatus = currentStatus === 'PENDING' ? 'PREPARING' : 'READY';
    const now = new Date().toISOString();
    
    setOrders((prev) => 
      prev.map((order) => {
        if (order.id === orderId) {
          return {
            ...order,
            status: nextStatus,
            started_at: nextStatus === 'PREPARING' ? now : order.started_at,
            ready_at: nextStatus === 'READY' ? now : order.ready_at
          } as Order;
        }
        return order;
      })
    );

    try {
      const { error } = await orderService.updateOrderStatus(orderId, nextStatus);
      if (error) {
        setErrorToast('Error de conexión con cocina');
        return;
      }
      setSuccessToast(nextStatus === 'PREPARING' ? '¡Pedido en fuego!' : '¡Pedido despachado!');
    } catch (err: any) {
      setErrorToast('Falla crítica de sistema');
    }
  }, [setOrders]);

  // 2. FIFO LOGIC & FILTERING
  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'PENDING' || o.status === 'PREPARING')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} 
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ChefHat className="w-16 h-16 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-8 relative overflow-hidden font-sans">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      
      <header className="flex items-center justify-between mb-12 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-primary/20">
            <ChefHat className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-none">Cocina</h1>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.4em] mt-2 leading-none">
              Producción en Tiempo Real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!useAuthStore.getState().user && (
            <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 px-4 py-2 rounded-2xl mr-4">
              <Signal className="w-4 h-4 text-warning" />
              <span className="text-[10px] font-black text-warning uppercase tracking-widest">Modo Invitado</span>
              <button 
                onClick={() => window.location.href = '/login'}
                className="ml-2 p-1.5 hover:bg-warning/20 rounded-lg transition-colors"
                title="Regresar al Login"
              >
                <LogOut size={14} className="text-warning" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-4 bg-surface-elevated/50 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)] ${isConnected ? 'bg-success' : 'bg-warning'}`} />
              <span className="text-xs font-black text-text-primary uppercase tracking-widest">
                {isConnected ? 'Conexión Activa' : 'Reconectando...'}
              </span>
            </div>
            {pendingCount > 0 && (
              <>
                <div className="w-px h-5 bg-white/10 mx-2" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-warning uppercase tracking-widest">
                    {pendingCount} Actualizando
                  </span>
                </div>
              </>
            )}
            <div className="w-px h-5 bg-white/10 mx-2" />
            <div className="flex items-center gap-2">
              <Signal className={`w-4 h-4 ${isConnected ? 'text-success' : 'text-warning'}`} />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                Sync {syncTimeDisplay}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* KITCHEN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 relative z-10 scroll-smooth">
        <AnimatePresence mode="popLayout" initial={false}>
          {activeOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onStatusChange={handleStatusChange} 
            />
          ))}
        </AnimatePresence>
      </div>

      {activeOrders.length === 0 && (
        <motion.div 
          {...ANIMATIONS.fadeIn}
          className="flex flex-col items-center justify-center h-[65vh] text-text-muted opacity-10 pointer-events-none"
        >
          <ChefHat size={200} strokeWidth={1} />
          <h2 className="text-4xl font-black mt-8 tracking-tighter uppercase">Todo al día, Chef</h2>
          <p className="text-lg font-bold mt-2 uppercase tracking-[0.3em]">Esperando pedidos de caja...</p>
        </motion.div>
      )}

      {/* FOOTER STATS SLIDE-IN (OPCIONAL) */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-surface-elevated shadow-2xl px-6 py-3 rounded-full border border-white/5 backdrop-blur-md flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Activos:</span>
            <span className="text-lg font-black text-text-primary leading-none">{activeOrders.length}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Demora Media:</span>
            <span className="text-lg font-black text-warning leading-none">4m</span>
          </div>
        </div>
      </footer>

      {/* TOAST SYSTEM */}
      <Toast 
        message={successToast || ''}
        type="success"
        isVisible={!!successToast}
        onClose={() => setSuccessToast(null)}
      />
      <Toast 
        message={errorToast || ''}
        type="error"
        isVisible={!!errorToast}
        onClose={() => setErrorToast(null)}
      />
    </div>
  );
};

export default KitchenPage;
