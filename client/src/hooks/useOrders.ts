import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order } from '../types/domain';

interface UseOrdersOptions {
  limit?: number;
  startDate?: string;
  maxCacheSize?: number;
}

interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  refetch: () => Promise<void>;
  pendingCount: number;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const FULL_ORDER_SELECT = '*, tables(*), order_items(*, products(*))';
const MAX_CACHE_SIZE = 200;
const BATCH_DELAY_MS = 0;
const POLLING_INTERVAL_MS = 15000; // Fallback polling every 15s if realtime fails

export const useOrders = (
  branchId: string | null,
  options: UseOrdersOptions = {},
  onNewOrder?: (order: Order) => void
): UseOrdersReturn => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fullOrdersCache = useRef<Map<string, Order>>(new Map());
  const pendingUpdates = useRef<Map<string, Order>>(new Map());
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;
  const pendingFetches = useRef<Set<string>>(new Set());

  const trimCache = useCallback(() => {
    if (fullOrdersCache.current.size > maxCacheSize) {
      const sortedOrders = Array.from(fullOrdersCache.current.entries())
        .sort((a, b) => new Date(b[1].created_at).getTime() - new Date(a[1].created_at).getTime());
      
      const toRemove = sortedOrders.slice(maxCacheSize);
      toRemove.forEach(([id]) => fullOrdersCache.current.delete(id));
    }
  }, [maxCacheSize]);

  const applyPendingUpdates = useCallback(() => {
    if (pendingUpdates.current.size === 0) return;

    setPendingCount(pendingUpdates.current.size);

    setOrders((prevOrders) => {
      const orderMap = new Map(prevOrders.map((o) => [o.id, o]));

      pendingUpdates.current.forEach((updatedOrder, orderId) => {
        orderMap.set(orderId, updatedOrder);
      });

      const updatedOrders = Array.from(orderMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      pendingUpdates.current.clear();
      setPendingCount(0);
      return updatedOrders;
    });

    setLastUpdate(new Date());
  }, []);

  const queueUpdate = useCallback((orderId: string, updatedOrder: Order) => {
    pendingUpdates.current.set(orderId, updatedOrder);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(applyPendingUpdates, BATCH_DELAY_MS);
  }, [applyPendingUpdates]);

  const fetchFullOrder = useCallback(async (orderId: string, forceRefresh = false): Promise<Order | null> => {
    // Only use cache for non-forced fetches (updates), never for new inserts
    if (!forceRefresh && fullOrdersCache.current.has(orderId)) {
      return fullOrdersCache.current.get(orderId)!;
    }

    // If a fetch is already in flight for this order, wait briefly and retry once
    if (pendingFetches.current.has(orderId)) {
      await new Promise((r) => setTimeout(r, 500));
      if (fullOrdersCache.current.has(orderId) && !forceRefresh) {
        return fullOrdersCache.current.get(orderId)!;
      }
    }

    pendingFetches.current.add(orderId);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(FULL_ORDER_SELECT)
        .eq('id', orderId)
        .single();

      if (error) {
        console.warn('[useOrders] fetchFullOrder error (posible bloqueo RLS):', orderId, error.message);
        return null;
      }
      if (!data) {
        console.warn('[useOrders] fetchFullOrder sin datos para:', orderId);
        return null;
      }

      const fullOrder = data as Order;
      fullOrdersCache.current.set(orderId, fullOrder);
      trimCache();
      return fullOrder;
    } finally {
      pendingFetches.current.delete(orderId);
    }
  }, [trimCache]);

  const loadOrders = useCallback(async () => {
    if (!branchId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(FULL_ORDER_SELECT)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const loadedOrders = data || [];
      fullOrdersCache.current.clear();
      loadedOrders.forEach((order: Order) => {
        fullOrdersCache.current.set(order.id, order);
      });

      setOrders(loadedOrders as Order[]);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, options.limit, options.startDate]);

  const refetch = useCallback(async () => {
    fullOrdersCache.current.clear();
    await loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!branchId) return;

    loadOrders();

    // ─── 1. REALTIME SUBSCRIPTION ────────────────────────────────────────────
    const channel = supabase
      .channel(`branch-orders-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        async (payload) => {
          const newPayload = payload.new as { id?: string } | null;
          const oldPayload = payload.old as { id?: string } | null;
          const orderId = newPayload?.id || oldPayload?.id;
          if (!orderId) return;

          if (payload.eventType === 'INSERT') {
            // forceRefresh=true: don't use cache for brand-new orders
            const fullOrder = await fetchFullOrder(orderId, true);
            if (fullOrder) {
              setOrders((prev) => {
                const exists = prev.some((o) => o.id === orderId);
                if (exists) return prev;
                return [fullOrder, ...prev];
              });
              if (onNewOrder) onNewOrder(fullOrder);
              setLastUpdate(new Date());
            } else {
              // If realtime fetch fails (e.g. RLS), trigger a full reload
              console.warn('[useOrders] INSERT fetch falló, recargando pedidos completos...');
              loadOrders();
            }
          } else if (payload.eventType === 'UPDATE') {
            const cachedOrder = fullOrdersCache.current.get(orderId);
            if (cachedOrder) {
              const updatedOrder = { ...cachedOrder, ...payload.new } as Order;
              fullOrdersCache.current.set(orderId, updatedOrder);
              queueUpdate(orderId, updatedOrder);
            } else {
              // Order not in cache yet, fetch it fresh
              const freshOrder = await fetchFullOrder(orderId, true);
              if (freshOrder) queueUpdate(orderId, freshOrder);
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            fullOrdersCache.current.delete(orderId);
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[useOrders] Realtime conectado para branch:', branchId);
        }
      });

    channelRef.current = channel;

    // ─── 2. POLLING FALLBACK (cada 15s por si falla el realtime o RLS) ────────
    const pollingInterval = setInterval(() => {
      // Solo recarga en silencio si el canal no está conectado
      if (channelRef.current) {
        loadOrders();
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [branchId, onNewOrder, fetchFullOrder, loadOrders, queueUpdate]);

  return { orders, loading, isConnected, lastUpdate, refetch, pendingCount, setOrders };
};
