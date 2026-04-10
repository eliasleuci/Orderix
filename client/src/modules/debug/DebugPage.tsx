import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

const DebugPage: React.FC = () => {
  const { user, branchId, tenantId, role, session } = useAuthStore();
  const [dbOrders, setDbOrders] = useState<any>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('NOT_STARTED');
  const [realtimeEvents, setRealtimeEvents] = useState<string[]>([]);
  const [rpcTest, setRpcTest] = useState<any>(null);
  const [directQuery, setDirectQuery] = useState<any>(null);

  // 1. Test direct query to orders table
  useEffect(() => {
    const testQuery = async () => {
      console.log('[DEBUG] Auth state:', { 
        userId: user?.id, 
        branchId, 
        tenantId, 
        role,
        hasSession: !!session,
        sessionExpiry: session?.expires_at
      });

      // Test 1: Query orders without any filter
      const { data: allOrders, error: allErr } = await supabase
        .from('orders')
        .select('id, status, branch_id, tenant_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('[DEBUG] All orders query:', { data: allOrders, error: allErr });

      // Test 2: Query orders filtering by branchId
      if (branchId) {
        const { data: branchOrders, error: brErr } = await supabase
          .from('orders')
          .select('id, status, branch_id, tenant_id, created_at, customer_name')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(5);
        
        console.log('[DEBUG] Branch orders query:', { branchId, data: branchOrders, error: brErr });
        setDbOrders(branchOrders);
        setDbError(brErr?.message || null);
      }

      // Test 3: Query with full select (same as useOrders)
      if (branchId) {
        const { data: fullOrders, error: fullErr } = await supabase
          .from('orders')
          .select('*, tables(*), order_items(*, products(*))')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(3);

        console.log('[DEBUG] Full select query:', { data: fullOrders, error: fullErr });
        setDirectQuery({ data: fullOrders, error: fullErr?.message });
      }
    };

    testQuery();
  }, [user, branchId, tenantId, role, session]);

  // 2. Test realtime subscription
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel('debug-orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const msg = `[${new Date().toLocaleTimeString()}] ${payload.eventType}: ${JSON.stringify(payload.new || payload.old).substring(0, 100)}`;
          console.log('[DEBUG] Realtime event:', msg);
          setRealtimeEvents(prev => [msg, ...prev].slice(0, 20));
        }
      )
      .subscribe((status) => {
        console.log('[DEBUG] Realtime subscription status:', status);
        setRealtimeStatus(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>🔍 DEBUG: Diagnóstico de Pedidos</h1>

      {/* AUTH STATE */}
      <section style={{ marginBottom: 24, padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
        <h2 style={{ color: '#f59e0b', marginBottom: 8 }}>Auth State</h2>
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify({
          userId: user?.id || 'NO USER',
          email: user?.email || 'N/A',
          role: role || 'NULL',
          branchId: branchId || 'NULL',
          tenantId: tenantId || 'NULL',
          hasSession: !!session,
          sessionExpiry: session?.expires_at || 'N/A'
        }, null, 2)}</pre>
      </section>

      {/* DB QUERY RESULT */}
      <section style={{ marginBottom: 24, padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
        <h2 style={{ color: dbError ? '#ef4444' : '#10b981', marginBottom: 8 }}>
          DB Query: orders WHERE branch_id = {branchId || 'null'}
        </h2>
        {dbError && <p style={{ color: '#ef4444' }}>ERROR: {dbError}</p>}
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {dbOrders ? `${dbOrders.length} órdenes encontradas:\n${JSON.stringify(dbOrders, null, 2)}` : 'Cargando...'}
        </pre>
      </section>

      {/* FULL SELECT */}
      <section style={{ marginBottom: 24, padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
        <h2 style={{ color: directQuery?.error ? '#ef4444' : '#10b981', marginBottom: 8 }}>
          Full Select (same as useOrders)
        </h2>
        {directQuery?.error && <p style={{ color: '#ef4444' }}>ERROR: {directQuery.error}</p>}
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {directQuery ? JSON.stringify(directQuery.data, null, 2) : 'Cargando...'}
        </pre>
      </section>

      {/* REALTIME STATUS */}
      <section style={{ marginBottom: 24, padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
        <h2 style={{ color: realtimeStatus === 'SUBSCRIBED' ? '#10b981' : '#f59e0b', marginBottom: 8 }}>
          Realtime Status: {realtimeStatus}
        </h2>
        <p style={{ fontSize: 12, color: '#888' }}>
          {realtimeEvents.length === 0 
            ? 'Esperando eventos... (creá un pedido desde el POS para ver si llega)' 
            : `${realtimeEvents.length} eventos recibidos:`}
        </p>
        {realtimeEvents.map((evt, i) => (
          <div key={i} style={{ fontSize: 11, color: '#6ee7b7', marginTop: 4, borderBottom: '1px solid #222', paddingBottom: 4 }}>
            {evt}
          </div>
        ))}
      </section>
    </div>
  );
};

export default DebugPage;
