import React, { useEffect, useState } from 'react';
import { orderService } from '../../services/orderService';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard,
  Calendar,
  Banknote,
  CreditCard,
  DollarSign,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

type DateFilter = 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';

const FinancialPage: React.FC = () => {
  const { branchId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoy');
  const [customDate, setCustomDate] = useState<string>('');
  const [stats, setStats] = useState({
    totalSales: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderCount: 0,
    avgTicket: 0,
  });

  useEffect(() => {
    if (!branchId) return;
    fetchStats();
  }, [branchId, dateFilter, customDate]);

  const fetchStats = async () => {
    if (!branchId) return;
    
    setLoading(true);
    let startDate = new Date();

    switch (dateFilter) {
      case 'hoy':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'ayer':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'mes':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'personalizado':
        if (customDate) {
          const [year, month, day] = customDate.split('-').map(Number);
          startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        }
        break;
    }

    const { data: orders } = await orderService.getBranchOrders(branchId, 500, startDate.toISOString());

    if (orders) {
      let filterEnd = new Date();
      if (dateFilter === 'hoy' || dateFilter === 'ayer' || dateFilter === 'personalizado') {
        filterEnd = new Date(startDate);
        filterEnd.setHours(23, 59, 59, 999);
      }

      const filteredOrders = orders.filter((o: any) => {
        const d = new Date(o.created_at);
        return d >= startDate && (dateFilter === 'semana' || dateFilter === 'mes' || d <= filterEnd);
      });

      const totalSales = filteredOrders.reduce((acc: number, o: any) => acc + Number(o.total ?? 0), 0);
      const cashTotal = filteredOrders
        .filter((o: any) => o.payment_method === 'CASH')
        .reduce((acc: number, o: any) => acc + Number(o.total ?? 0), 0);
      const cardTotal = filteredOrders
        .filter((o: any) => o.payment_method === 'CARD' || o.payment_method === 'DIGITAL')
        .reduce((acc: number, o: any) => acc + Number(o.total ?? 0), 0);

      setStats({
        totalSales,
        cashTotal,
        cardTotal,
        orderCount: filteredOrders.length,
        avgTicket: filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0,
      });
    }
    setLoading(false);
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'hoy': return 'Hoy';
      case 'ayer': return 'Ayer';
      case 'semana': return 'Últimos 7 días';
      case 'mes': return 'Mes actual';
      case 'personalizado': return customDate ? customDate.split('-').reverse().join('/') : 'Personalizado';
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-success/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 relative z-10 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center border border-success/20">
              <DollarSign size={24} className="text-success" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Panel Financiero</h1>
          </div>
          <p className="text-text-muted text-sm font-medium ml-1">Resumen de facturación y métodos de pago</p>
        </div>

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
          <Button 
            variant="ghost" 
            size="md"
            onClick={() => setDateFilter('semana')}
            className={dateFilter === 'semana' ? "bg-white/5 text-text-primary" : "text-text-muted hover:text-text-secondary"}
          >
            Semana
          </Button>
          <Button 
            variant="ghost" 
            size="md"
            onClick={() => setDateFilter('mes')}
            className={dateFilter === 'mes' ? "bg-success/20 text-success" : "text-text-muted hover:text-text-secondary"}
          >
            Mes
          </Button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <div className="relative flex items-center">
            <input
              type="date"
              id="customDatePickerFin"
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
                const picker = document.getElementById('customDatePickerFin') as any;
                if (picker && picker.showPicker) {
                  picker.showPicker();
                }
              }}
              leftIcon={<Calendar size={18} />}
              className={customDate && dateFilter === 'personalizado' ? 'border border-primary z-20' : 'z-20'}
            >
              {dateFilter === 'personalizado' ? getFilterLabel() : 'Fecha'}
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-surface-elevated/50 rounded-[2.5rem] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card variant="glass" padding="normal" className="relative group overflow-hidden border-white/5 bg-slate-900/40">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-success/10 border border-success/20 group-hover:scale-110 transition-transform">
                  <DollarSign className="text-success" size={24} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Total Facturado</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
                    ${stats.totalSales.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-text-muted mt-2">{getFilterLabel()}</p>
              </div>
            </Card>

            <Card variant="glass" padding="normal" className="relative group overflow-hidden border-white/5 bg-slate-900/40">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="text-text-secondary" size={24} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Pedidos</h3>
                <span className="text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
                  {stats.orderCount}
                </span>
              </div>
            </Card>

            <Card variant="glass" padding="normal" className="relative group overflow-hidden border-white/5 bg-slate-900/40">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                  <TrendingUp className="text-text-secondary" size={24} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Ticket Promedio</h3>
                <span className="text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
                  ${stats.avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </Card>

            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-[2.5rem] border border-primary/20 p-6 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Total Métodos</p>
                <p className="text-5xl font-black text-primary tracking-tighter font-display">
                  {((stats.cashTotal + stats.cardTotal) / (stats.totalSales || 1) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-success/10 rounded-3xl flex items-center justify-center border border-success/20">
                  <Banknote size={32} className="text-success" />
                </div>
                <div>
                  <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Cobrado en Efectivo</h3>
                  <span className="text-4xl font-black text-success tracking-tighter leading-none">
                    ${stats.cashTotal.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalSales > 0 ? (stats.cashTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] font-bold text-text-muted mt-2 text-right">
                {stats.totalSales > 0 ? ((stats.cashTotal / stats.totalSales) * 100).toFixed(1) : 0}% del total
              </p>
            </Card>

            <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20">
                  <CreditCard size={32} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Tarjeta / QR / Transferencia</h3>
                  <span className="text-4xl font-black text-primary tracking-tighter leading-none">
                    ${stats.cardTotal.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalSales > 0 ? (stats.cardTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] font-bold text-text-muted mt-2 text-right">
                {stats.totalSales > 0 ? ((stats.cardTotal / stats.totalSales) * 100).toFixed(1) : 0}% del total
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialPage;
