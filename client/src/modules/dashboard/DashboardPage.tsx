import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { orderService } from '../../services/orderService';
import { useAuthStore } from '../../store/authStore';
import { 
  ShoppingBag, 
  ChefHat, 
  LayoutDashboard,
  Calendar,
  History,
  Trash2,
  Timer,
  PackageCheck,
  CheckCircle,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { Order } from '../../types/domain';
import { cn } from '../../lib/utils';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const getDur = (from: string, to: string) => {
  const diff = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const totalSec = Math.floor(diff / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
};

const MiniTimeline: React.FC<{ order: Order }> = React.memo(({ order }) => {
  const steps = [
    {
      label: 'Recibido',
      time: fmtTime(order.created_at),
      done: true,
      icon: <PackageCheck size={10} />,
      color: 'bg-primary/20 border-primary/40 text-primary',
    },
    {
      label: 'Cocina',
      time: order.started_at ? fmtTime(order.started_at) : null,
      duration: order.started_at ? getDur(order.created_at, order.started_at) : null,
      done: !!order.started_at,
      icon: <ChefHat size={10} />,
      color: order.started_at ? 'bg-warning/20 border-warning/40 text-warning' : 'bg-white/5 border-white/10 text-text-muted',
    },
    {
      label: 'Listo',
      time: order.ready_at ? fmtTime(order.ready_at) : null,
      duration: order.ready_at ? getDur(order.started_at || order.created_at, order.ready_at) : null,
      done: !!order.ready_at,
      icon: <CheckCircle size={10} />,
      color: order.ready_at ? 'bg-success/20 border-success/40 text-success' : 'bg-white/5 border-white/10 text-text-muted',
    },
  ];

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-1.5 mb-3">
        <Timer size={11} className="text-text-muted" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Línea de Tiempo</span>
      </div>
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${step.color}`}>
                {step.icon}
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest mt-1.5 text-text-muted leading-none">{step.label}</p>
              {step.time ? (
                <p className="text-[11px] font-bold text-text-muted tabular-nums leading-none mt-0.5">{step.time}</p>
              ) : (
                <p className="text-[11px] text-white/10 leading-none mt-0.5">—</p>
              )}
              {step.duration && (
                <p className="text-[10px] font-black text-text-muted leading-none opacity-60 mt-0.5">({step.duration})</p>
              )}
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-px flex-1 mb-7 mx-1 ${steps[idx+1].done ? 'bg-white/20' : 'bg-white/5'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});

const Sparkline = React.memo(({ data, color }: { data: number[], color: string }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-8 opacity-50" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
});

const DashboardStat = React.memo(({ title, value, subValue, icon, trend, color, sparkData }: any) => (
  <Card variant="glass" padding="normal" className="relative group overflow-hidden border-white/5 bg-slate-900/40">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform", color)}>
        {icon}
      </div>
      {sparkData && <Sparkline data={sparkData} color={trend === 'up' ? '#10b981' : '#f59e0b'} />}
    </div>
    
    <div className="space-y-1">
      <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
          {value}
        </span>
        {trend && (
          <span className={cn("text-[10px] font-black flex items-center mb-1", trend === 'up' ? 'text-success' : 'text-warning')}>
            <ArrowUpRight size={12} className={trend === 'down' ? 'rotate-90' : ''} /> {subValue}
          </span>
        )}
      </div>
    </div>
  </Card>
));

const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="h-44 bg-surface-elevated/50 rounded-[2.5rem] animate-pulse border border-white/5" />
    ))}
  </div>
);

const DashboardPage: React.FC = () => {
  const { branchId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'hoy' | 'ayer' | 'personalizado'>('hoy');
  const [customDate, setCustomDate] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState<any>({
    orders: 0,
    activeOrders: 0,
    recentOrders: [],
  });

  const fetchStats = useCallback(async (silent = false) => {
    if (!branchId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (dateFilter === 'ayer') {
      startDate.setDate(startDate.getDate() - 1);
    } else if (dateFilter === 'personalizado' && customDate) {
      const [year, month, day] = customDate.split('-').map(Number);
      startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    }

    const { data: fetchedOrders } = await orderService.getBranchOrders(
      branchId, 
      100,
      startDate.toISOString()
    );

    if (fetchedOrders) {
      let filterEnd = new Date(startDate);
      filterEnd.setHours(23, 59, 59, 999);

      const filteredOrders = fetchedOrders.filter((o: Order) => {
        const d = new Date(o.created_at);
        return d >= startDate && d <= filterEnd;
      });

      const orderCount = filteredOrders.length;
      const active = filteredOrders.filter((o: Order) => o.status === 'PENDING' || o.status === 'PREPARING').length;

      setStats({
        orders: orderCount,
        activeOrders: active,
        recentOrders: filteredOrders
          .filter((o: Order) => ['PENDING', 'PREPARING', 'READY'].includes(o.status))
          .sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8),
      });
    }
    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, [branchId, dateFilter, customDate]);

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 20 seconds so new orders always appear
    pollingRef.current = setInterval(() => fetchStats(true), 20000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStats]);

  const handleResetOrders = useCallback(async () => {
    if (!branchId) return;
    if (!confirm('¿Estás seguro de eliminar TODOS los pedidos de esta sucursal? Esta acción no se puede deshacer.')) return;

    setLoading(true);
    const { error } = await orderService.deleteAllBranchOrders(branchId);
    
    if (error) {
      alert(`Error al limpiar pedidos: ${error}`);
    } else {
      window.location.reload();
    }
    setLoading(false);
  }, [branchId]);

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-10 font-sans relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 relative z-10 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <LayoutDashboard size={24} className="text-primary" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Panel de Control</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="md" 
            onClick={() => fetchStats(true)}
            leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
            className="text-text-muted hover:text-text-primary border border-white/10"
          >
            Actualizar
          </Button>
          <Button 
            variant="ghost" 
            size="md" 
            onClick={handleResetOrders}
            leftIcon={<Trash2 size={18} />}
            className="text-danger hover:bg-danger/10 border border-danger/20"
          >
            Limpiar Pedidos
          </Button>

          <div className="flex items-center gap-3 bg-surface-elevated/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5">
          <Button 
            variant="ghost" 
            size="md" 
            onClick={() => setDateFilter('hoy')}
            className={dateFilter === 'hoy' ? "bg-white/5 text-text-primary" : "text-text-muted hover:text-text-secondary"}
          >
            Hoy
          </Button>
          <Button 
            variant="ghost" 
            size="md"
            onClick={() => setDateFilter('ayer')}
            className={dateFilter === 'ayer' ? "bg-white/5 text-text-primary" : "text-text-muted hover:text-text-secondary"}
          >
            Ayer
          </Button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <div className="relative flex items-center">
            <input
              type="date"
              id="customDatePicker"
              value={customDate}
              title="Seleccionar Fecha"
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter('personalizado');
              }}
              className="absolute left-0 top-0 w-0 h-0 opacity-0 overflow-hidden" 
              style={{ colorScheme: 'dark' }}
            />
            <Button 
              variant={dateFilter === 'personalizado' ? "primary" : "secondary"} 
              size="md" 
              onClick={() => {
                setDateFilter('personalizado');
                const picker = document.getElementById('customDatePicker') as any;
                if (picker && picker.showPicker) {
                  picker.showPicker();
                }
              }}
              leftIcon={<Calendar size={18} />}
              className={customDate && dateFilter === 'personalizado' ? 'border border-primary z-20' : 'z-20'}
            >
              {dateFilter === 'personalizado' && customDate 
                ? customDate.split('-').reverse().join('/') 
                : 'Personalizado'}
            </Button>
          </div>
        </div>
      </div>
    </header>

      {loading ? <DashboardSkeleton /> : (
        <div className="space-y-10 relative z-10">
          {/* TOP KPIs GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardStat 
              title="Pedidos Totales" 
              value={stats.orders} 
              icon={<ShoppingBag className="text-text-secondary" />} 
            />
            <DashboardStat 
              title="Pedidos Activos" 
              value={stats.activeOrders} 
              icon={<ChefHat className="text-warning" />} 
              color="border-warning/20 bg-warning/5"
            />
          </div>

          {/* BENTO BOTTOM SECTION */}
          <div className="grid grid-cols-1 gap-8">
            {/* RECENT ACTIVITY */}
            <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <History className="text-primary" size={24} />
                  <h2 className="text-xl font-black uppercase tracking-tight">Actividad Reciente</h2>
                </div>
                <Button variant="ghost" size="md">Ver Todo</Button>
              </div>

              <div className="space-y-4">
                {stats.recentOrders.map((order: Order) => (
                  <div key={order.id} className="group flex flex-col p-5 rounded-[2rem] bg-surface-base/50 border border-white/5 hover:border-primary/30 transition-all cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center font-black text-xs text-text-muted border border-white/5 group-hover:text-primary transition-colors shrink-0">
                          #{(order.id || '').substring(0, 4).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-text-primary leading-none mb-1 group-hover:text-primary transition-colors">
                            {order.customer_name || 'Consumidor Final'}
                          </h4>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-muted font-medium">
                              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="w-1 h-1 bg-white/10 rounded-full" />
                            <div className="flex gap-2">
                              {order.status === 'READY' ? <Badge variant="success">Listo</Badge> : 
                               order.status === 'PREPARING' ? <Badge variant="warning">En Cocina</Badge> :
                               order.status === 'DELIVERED' ? <Badge variant="neutral">Entregado</Badge> :
                               <Badge variant="neutral">Pendiente</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-text-primary tracking-tighter">${order.total}</div>
                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{order.payment_method || 'Efectivo'}</div>
                      </div>
                    </div>
                    {/* MINI TIMELINE */}
                    <MiniTimeline order={order} />
                  </div>
                ))}
                {stats.recentOrders.length === 0 && (
                  <div className="py-20 text-center text-text-muted opacity-20 italic font-bold uppercase tracking-widest">
                    Sin actividad reciente
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
