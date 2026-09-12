import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { orderService } from '../../services/orderService';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard,
  Calendar,
  Banknote,
  CreditCard,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  UtensilsCrossed,
  Store,
  Bike,
  Clock
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import BotonReporte from '../reports/BotonReporte';

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
    // Desglose por tipo de venta: salón, mostrador y delivery.
    salon: { total: 0, cantidad: 0 },
    mostrador: { total: 0, cantidad: 0 },
    delivery: { total: 0, cantidad: 0 },
    // Cuánto del total facturado fue costo de envío y no comida.
    envios: 0,
    // Mesas abiertas: el pedido existe y suma al total, pero todavía no se
    // cobró (queda en UNPAID hasta que se cierra la cuenta).
    pendiente: { total: 0, cantidad: 0 },
  });

  const fetchStats = useCallback(async () => {
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

      // El POS guarda el tipo como MESA (salón), TAKEAWAY (mostrador y retiro)
      // y DELIVERY (envío).
      const porTipo = (tipo: string) => {
        const del = filteredOrders.filter((o: any) => o.order_type === tipo);
        return {
          total: del.reduce((a: number, o: any) => a + Number(o.total ?? 0), 0),
          cantidad: del.length,
        };
      };

      const sinCobrar = filteredOrders.filter((o: any) => o.payment_method === 'UNPAID');

      setStats({
        totalSales,
        cashTotal,
        cardTotal,
        orderCount: filteredOrders.length,
        avgTicket: filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0,
        salon: porTipo('MESA'),
        mostrador: porTipo('TAKEAWAY'),
        delivery: porTipo('DELIVERY'),
        envios: filteredOrders.reduce((a: number, o: any) => a + Number(o.delivery_fee ?? 0), 0),
        pendiente: {
          total: sinCobrar.reduce((a: number, o: any) => a + Number(o.total ?? 0), 0),
          cantidad: sinCobrar.length,
        },
      });
    }
    setLoading(false);
  }, [branchId, dateFilter, customDate]);

  useEffect(() => {
    if (!branchId) return;
    fetchStats();
  }, [branchId, fetchStats]);

  const getFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case 'hoy': return 'Hoy';
      case 'ayer': return 'Ayer';
      case 'semana': return 'Últimos 7 días';
      case 'mes': return 'Mes actual';
      case 'personalizado': return customDate ? customDate.split('-').reverse().join('/') : 'Personalizado';
    }
  }, [dateFilter, customDate]);

  const handleSetDateFilter = useCallback((filter: DateFilter) => {
    setDateFilter(filter);
  }, []);

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-4 lg:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 hidden lg:block w-[1000px] h-[1000px] bg-success/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 relative z-10 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center border border-success/20">
              <DollarSign size={24} className="text-success" />
            </div>
            <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Panel Financiero</h1>
          </div>
          <p className="text-text-muted text-sm font-medium ml-1">Resumen de facturación y métodos de pago</p>
        </div>

        <BotonReporte />

        <div className="flex items-center gap-3 bg-surface-elevated/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none max-w-full">
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
              {dateFilter === 'personalizado' ? getFilterLabel : 'Fecha'}
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
                  <span className="text-3xl lg:text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
                    ${stats.totalSales.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-text-muted mt-2">{getFilterLabel}</p>
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
                <span className="text-3xl lg:text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
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
                <span className="text-3xl lg:text-4xl font-black text-text-primary tracking-tighter font-display leading-none">
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

          {/* ---------- VENTAS POR TIPO ---------- */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-black uppercase tracking-tighter">Ventas por tipo</h2>
              <span className="text-text-muted text-xs font-bold">
                Salón, mostrador y delivery
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: 'salon', label: 'Salón', detalle: 'Comieron en el local', icon: UtensilsCrossed, color: 'text-primary', bg: 'bg-primary/10', borde: 'border-primary/20', barra: 'bg-primary', datos: stats.salon },
                { id: 'mostrador', label: 'Mostrador', detalle: 'Pasaron a retirar', icon: Store, color: 'text-success', bg: 'bg-success/10', borde: 'border-success/20', barra: 'bg-success', datos: stats.mostrador },
                { id: 'delivery', label: 'Delivery', detalle: 'Envío a domicilio', icon: Bike, color: 'text-warning', bg: 'bg-warning/10', borde: 'border-warning/20', barra: 'bg-warning', datos: stats.delivery },
              ].map((t) => {
                const porcentaje = stats.totalSales > 0 ? (t.datos.total / stats.totalSales) * 100 : 0;
                const Icono = t.icon;
                return (
                  <Card key={t.id} variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
                    <div className="flex items-center gap-4 mb-5">
                      <div className={`w-14 h-14 ${t.bg} rounded-3xl flex items-center justify-center border ${t.borde} shrink-0`}>
                        <Icono size={26} className={t.color} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                          {t.label}
                        </h3>
                        <span className={`text-3xl font-black ${t.color} tracking-tighter leading-none block`}>
                          ${t.datos.total.toLocaleString()}
                        </span>
                        <p className="text-[10px] font-bold text-text-muted mt-1">{t.detalle}</p>
                      </div>
                    </div>

                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${t.barra} rounded-full transition-all duration-500`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-bold text-text-muted">
                        {t.datos.cantidad} {t.datos.cantidad === 1 ? 'pedido' : 'pedidos'}
                      </span>
                      <span className="text-[10px] font-bold text-text-muted">
                        {porcentaje.toFixed(1)}% del total
                      </span>
                    </div>

                    {/* El envío está sumado al total de arriba; se discrimina
                        para no confundir plata de comida con plata de reparto. */}
                    {t.id === 'delivery' && stats.envios > 0 && (
                      <p className="text-[10px] font-bold text-text-muted mt-2 pt-2 border-t border-white/5">
                        Incluye ${stats.envios.toLocaleString()} de costo de envío
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Las mesas abiertas ya suman al total facturado pero todavía no se
                cobraron: se avisa para que no se confunda con plata en caja. */}
            {stats.pendiente.cantidad > 0 && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4">
                <Clock size={20} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-warning">
                    ${stats.pendiente.total.toLocaleString()} sin cobrar
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {stats.pendiente.cantidad} {stats.pendiente.cantidad === 1 ? 'pedido de mesa abierta' : 'pedidos de mesas abiertas'}.
                    Ya están sumados en el total facturado, pero el dinero se cobra al cerrar la cuenta.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialPage;
