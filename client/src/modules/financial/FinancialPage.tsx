import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Clock,
  ChevronDown,
  Receipt,
  UserRound,
  Percent
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import BotonReporte from '../reports/BotonReporte';
import { tableService, Mozo } from '../../services/tableService';
import { etiquetaMedioPago, etiquetaCorta, esEfectivo, estaCobrado } from '../../lib/mediosDePago';

type DateFilter = 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';

const FinancialPage: React.FC = () => {
  const { branchId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoy');
  const [customDate, setCustomDate] = useState<string>('');
  // Los pedidos del período, para poder desplegar cuáles componen cada total.
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [tipoAbierto, setTipoAbierto] = useState<string | null>(null);
  // Estado propio y no compartido con tipoAbierto: si no, abrir un mozo
  // cerraría el desglose por tipo y al revés.
  const [mozoAbierto, setMozoAbierto] = useState<string | null>(null);
  const [verMedios, setVerMedios] = useState(false);
  const [mozos, setMozos] = useState<Mozo[]>([]);
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
        .filter((o: any) => esEfectivo(o.payment_method))
        .reduce((acc: number, o: any) => acc + Number(o.total ?? 0), 0);
      // Todo lo cobrado que no sea efectivo. Enumerar los medios uno por uno
      // dejaba afuera cualquiera que se agregara después, como pasó con QR.
      const cardTotal = filteredOrders
        .filter((o: any) => estaCobrado(o.payment_method) && !esEfectivo(o.payment_method))
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

      setPedidos(filteredOrders);

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

  // Se piden los pausados también: un mozo que ya no trabaja igual vendió en
  // el período y su comisión hay que liquidarla.
  useEffect(() => {
    if (!branchId) return;
    tableService.getMozos(branchId, true).then(({ data }) => setMozos(data ?? []));
  }, [branchId]);

  /**
   * Ventas agrupadas por mozo. Sale de los mismos pedidos que ya se trajeron
   * para los totales de arriba, así que no cuesta una consulta más.
   *
   * La comisión se calcula con el porcentaje guardado EN EL PEDIDO, no con el
   * que tiene el mozo hoy: si le cambian la comisión, lo ya liquidado no se
   * mueve.
   */
  /**
   * Cada forma de cobro por separado. Antes tarjeta, QR y transferencia caían
   * todas en el mismo total y no había forma de saber cuánto entró por cada una.
   */
  const porMedioDePago = useMemo(() => {
    const acumulado = new Map<string, { total: number; cantidad: number }>();

    for (const o of pedidos) {
      const medio = o.payment_method;
      if (!estaCobrado(medio) || esEfectivo(medio)) continue;

      const actual = acumulado.get(medio) ?? { total: 0, cantidad: 0 };
      actual.total += Number(o.total ?? 0);
      actual.cantidad += 1;
      acumulado.set(medio, actual);
    }

    return [...acumulado.entries()]
      .map(([medio, datos]) => ({ medio, nombre: etiquetaMedioPago(medio), ...datos }))
      .sort((a, b) => b.total - a.total);
  }, [pedidos]);

  const ventasPorMozo = useMemo(() => {
    const porMozo = new Map<string, { total: number; cantidad: number; comision: number }>();

    for (const o of pedidos) {
      if (!o.waiter_id) continue;
      const actual = porMozo.get(o.waiter_id) ?? { total: 0, cantidad: 0, comision: 0 };
      const total = Number(o.total ?? 0);
      actual.total += total;
      actual.cantidad += 1;
      actual.comision += total * (Number(o.waiter_commission_pct ?? 0) / 100);
      porMozo.set(o.waiter_id, actual);
    }

    return [...porMozo.entries()]
      .map(([id, datos]) => ({
        id,
        nombre: mozos.find((m) => m.id === id)?.name ?? 'Mozo dado de baja',
        ...datos,
      }))
      .sort((a, b) => b.total - a.total);
  }, [pedidos, mozos]);

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

  // Al cambiar de período el detalle abierto mostraría pedidos que ya no son
  // los del total de arriba.
  useEffect(() => {
    setTipoAbierto(null);
    setMozoAbierto(null);
    setVerMedios(false);
  }, [dateFilter, customDate]);

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

        <div className="flex items-center gap-3 bg-surface-elevated/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none max-w-full">
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

              {/* Las tres formas van juntas en el total de arriba, pero cada una
                  se cobra distinto: hace falta poder abrirlas. */}
              {porMedioDePago.length > 0 && (
                <>
                  <button
                    onClick={() => setVerMedios((v) => !v)}
                    aria-expanded={verMedios}
                    className="inline-flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest mt-4 hover:text-primary-hover transition-colors"
                  >
                    {verMedios ? 'Ocultar detalle' : 'Ver por forma de cobro'}
                    <ChevronDown size={12} className={`transition-transform ${verMedios ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {verMedios && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                          {porMedioDePago.map((m) => {
                            const parte = stats.cardTotal > 0 ? (m.total / stats.cardTotal) * 100 : 0;
                            return (
                              <div key={m.medio} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-text-secondary w-28 shrink-0 truncate">
                                  {m.nombre}
                                </span>
                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary/60 rounded-full transition-all duration-500"
                                    style={{ width: `${parte}%` }}
                                  />
                                </div>
                                <span className="text-xs font-black text-text-primary shrink-0 w-24 text-right tabular-nums">
                                  ${m.total.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold text-text-muted shrink-0 w-16 text-right">
                                  {m.cantidad} {m.cantidad === 1 ? 'pago' : 'pagos'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
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
                { id: 'salon', tipo: 'MESA', label: 'Salón', detalle: 'Comieron en el local', icon: UtensilsCrossed, color: 'text-primary', bg: 'bg-primary/10', borde: 'border-primary/20', barra: 'bg-primary', datos: stats.salon },
                { id: 'mostrador', tipo: 'TAKEAWAY', label: 'Mostrador', detalle: 'Pasaron a retirar', icon: Store, color: 'text-success', bg: 'bg-success/10', borde: 'border-success/20', barra: 'bg-success', datos: stats.mostrador },
                { id: 'delivery', tipo: 'DELIVERY', label: 'Delivery', detalle: 'Envío a domicilio', icon: Bike, color: 'text-warning', bg: 'bg-warning/10', borde: 'border-warning/20', barra: 'bg-warning', datos: stats.delivery },
              ].map((t) => {
                const porcentaje = stats.totalSales > 0 ? (t.datos.total / stats.totalSales) * 100 : 0;
                const Icono = t.icon;
                const abierta = tipoAbierto === t.id;
                // Sin pedidos no hay nada que desplegar: abrir un panel vacío
                // parece que la pantalla falló.
                const desplegable = t.datos.cantidad > 0;
                const alternar = () => desplegable && setTipoAbierto(abierta ? null : t.id);
                return (
                  <Card
                    key={t.id}
                    variant="solid"
                    padding="large"
                    onClick={alternar}
                    role={desplegable ? 'button' : undefined}
                    tabIndex={desplegable ? 0 : undefined}
                    aria-expanded={desplegable ? abierta : undefined}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        alternar();
                      }
                    }}
                    className={`bg-surface-elevated/40 transition-colors ${
                      desplegable ? 'cursor-pointer' : ''
                    } ${abierta ? 'border-primary/40' : `border-white/5 ${desplegable ? 'hover:border-white/20' : ''}`}`}
                  >
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

                    {desplegable && (
                      <span className="inline-flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest mt-3">
                        {abierta ? 'Ocultar pedidos' : 'Ver pedidos'}
                        <ChevronDown size={12} className={`transition-transform ${abierta ? 'rotate-180' : ''}`} />
                      </span>
                    )}

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

            {/* ---------- DETALLE DEL TIPO ELEGIDO ---------- */}
            <AnimatePresence initial={false}>
              {tipoAbierto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 rounded-[2rem] border border-primary/20 bg-surface-elevated/40 p-5 lg:p-6">
                    {(() => {
                      const tipos: Record<string, { tipo: string; label: string }> = {
                        salon: { tipo: 'MESA', label: 'Salón' },
                        mostrador: { tipo: 'TAKEAWAY', label: 'Mostrador' },
                        delivery: { tipo: 'DELIVERY', label: 'Delivery' },
                      };
                      const actual = tipos[tipoAbierto];
                      const delTipo = pedidos.filter((o: any) => o.order_type === actual.tipo);

                      return (
                        <>
                          <div className="flex items-center gap-3 mb-5">
                            <Receipt size={18} className="text-primary" />
                            <h3 className="font-black uppercase tracking-tighter">
                              Pedidos de {actual.label}
                            </h3>
                            <span className="text-text-muted text-xs font-bold">
                              {delTipo.length} {delTipo.length === 1 ? 'pedido' : 'pedidos'}
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                            {delTipo.map((o: any) => {
                              const envio = Number(o.delivery_fee ?? 0);
                              const mesa = o.tables?.label || (o.tables?.number ? `Mesa ${o.tables.number}` : null);
                              const sinCobrar = o.payment_method === 'UNPAID';

                              return (
                                <div
                                  key={o.id}
                                  className="flex items-center gap-4 rounded-2xl border border-white/5 bg-surface-base px-4 py-3"
                                >
                                  <span className="font-black text-text-muted text-xs shrink-0 w-12">
                                    #{o.ticket_number ?? '—'}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">
                                      {o.customer_name || mesa || 'Sin nombre'}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-0.5 truncate">
                                      {new Date(o.created_at).toLocaleString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                      {mesa && o.customer_name ? ` · ${mesa}` : ''}
                                      {o.customer_address ? ` · ${o.customer_address}` : ''}
                                      {envio > 0 ? ` · envío $${envio.toLocaleString()}` : ''}
                                    </p>
                                  </div>

                                  <span
                                    className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                      sinCobrar
                                        ? 'text-warning border-warning/30 bg-warning/10'
                                        : 'text-text-muted border-white/10 bg-white/5'
                                    }`}
                                  >
                                    {etiquetaCorta(o.payment_method)}
                                  </span>

                                  <span className="font-black tracking-tighter shrink-0 w-24 text-right">
                                    ${Number(o.total ?? 0).toLocaleString()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

          {/* ---------- VENTAS POR MOZO ---------- */}
          {ventasPorMozo.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-xl font-black uppercase tracking-tighter">Ventas por mozo</h2>
                <span className="text-text-muted text-xs font-bold">
                  Para liquidar comisiones
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ventasPorMozo.map((m) => {
                  const abierto = mozoAbierto === m.id;
                  return (
                    <Card
                      key={m.id}
                      variant="solid"
                      padding="large"
                      onClick={() => setMozoAbierto(abierto ? null : m.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={abierto}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setMozoAbierto(abierto ? null : m.id);
                        }
                      }}
                      className={`bg-surface-elevated/40 cursor-pointer transition-colors ${
                        abierto ? 'border-primary/40' : 'border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shrink-0">
                          <UserRound size={26} className="text-text-secondary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] truncate">
                            {m.nombre}
                          </h3>
                          <span className="text-3xl font-black tracking-tighter leading-none block">
                            ${m.total.toLocaleString()}
                          </span>
                          <p className="text-[10px] font-bold text-text-muted mt-1">
                            {m.cantidad} {m.cantidad === 1 ? 'pedido' : 'pedidos'}
                          </p>
                        </div>
                      </div>

                      {/* La comisión es el número que se le paga: va destacado
                          y separado del total vendido, que es otra cosa. */}
                      <div className="flex items-center justify-between rounded-2xl border border-success/20 bg-success/10 px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                          <Percent size={12} /> Comisión
                        </span>
                        <span className="text-xl font-black text-success tracking-tighter">
                          ${m.comision.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest mt-3">
                        {abierto ? 'Ocultar pedidos' : 'Ver pedidos'}
                        <ChevronDown size={12} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      </span>
                    </Card>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
                {mozoAbierto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 rounded-[2rem] border border-primary/20 bg-surface-elevated/40 p-5 lg:p-6">
                      {(() => {
                        const mozo = ventasPorMozo.find((m) => m.id === mozoAbierto);
                        const suyos = pedidos.filter((o: any) => o.waiter_id === mozoAbierto);

                        return (
                          <>
                            <div className="flex items-center gap-3 mb-5">
                              <Receipt size={18} className="text-primary" />
                              <h3 className="font-black uppercase tracking-tighter">
                                Pedidos de {mozo?.nombre}
                              </h3>
                              <span className="text-text-muted text-xs font-bold">
                                {suyos.length} {suyos.length === 1 ? 'pedido' : 'pedidos'}
                              </span>
                            </div>

                            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                              {suyos.map((o: any) => {
                                const mesa = o.tables?.label || (o.tables?.number ? `Mesa ${o.tables.number}` : null);
                                const pct = Number(o.waiter_commission_pct ?? 0);
                                const comision = Number(o.total ?? 0) * (pct / 100);

                                return (
                                  <div
                                    key={o.id}
                                    className="flex items-center gap-4 rounded-2xl border border-white/5 bg-surface-base px-4 py-3"
                                  >
                                    <span className="font-black text-text-muted text-xs shrink-0 w-12">
                                      #{o.ticket_number ?? '—'}
                                    </span>

                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-sm truncate">
                                        {mesa || o.customer_name || 'Sin mesa'}
                                      </p>
                                      <p className="text-[10px] text-text-muted mt-0.5">
                                        {new Date(o.created_at).toLocaleString('es-AR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {pct > 0 ? ` · ${pct}% de comisión` : ' · sin comisión'}
                                      </p>
                                    </div>

                                    {comision > 0 && (
                                      <span className="text-sm font-black text-success shrink-0">
                                        +${comision.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      </span>
                                    )}

                                    <span className="font-black tracking-tighter shrink-0 w-24 text-right">
                                      ${Number(o.total ?? 0).toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialPage;
