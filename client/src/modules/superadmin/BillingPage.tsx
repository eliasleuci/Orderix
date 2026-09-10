import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, AlertTriangle, HelpCircle, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import DataState from './components/DataState';
import SubscriptionBadge from './components/SubscriptionBadge';
import { superadminService } from '../../services/superadminService';
import type { BillingOverview } from '../../types/superadmin';

const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—');
const plata = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-AR')}`;

export default function BillingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await superadminService.getBillingOverview();
    setError(res.error);
    setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const r = data?.resumen;

  const tarjetas = [
    { label: 'Al día', valor: r?.alDia ?? 0, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Por vencer', valor: r?.porVencer ?? 0, icon: Clock, color: 'text-orange-400' },
    { label: 'Vencidos', valor: r?.vencidos ?? 0, icon: AlertTriangle, color: 'text-rose-400' },
    { label: 'Sin fecha', valor: r?.sinFecha ?? 0, icon: HelpCircle, color: 'text-white/40' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tighter text-white">Facturación</h1>
        <p className="text-white/50 font-medium mt-2">
          Quién está al día y a quién hay que cobrarle. Los vencidos aparecen primero.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <t.icon className={t.color} size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                {t.label}
              </span>
            </div>
            <p className="text-3xl font-black text-white mt-2">{t.valor}</p>
          </div>
        ))}
      </div>

      <Card variant="solid" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-widest font-bold text-white/50">
                <th className="p-4 pl-6">Cliente</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Pagado hasta</th>
                <th className="p-4">Último pago</th>
                <th className="p-4">Acceso</th>
                <th className="p-4 pr-6" />
              </tr>
            </thead>
            <tbody>
              <DataState
                loading={loading}
                error={error}
                empty={(data?.clientes.length ?? 0) === 0}
                emptyMessage="No hay clientes para facturar"
                onRetry={cargar}
                colSpan={6}
              />

              {!loading &&
                !error &&
                data?.clientes.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/superadmin/clientes/${c.id}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="p-4 pl-6">
                      <p className="font-black text-white">{c.name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{c.email ?? c.slug}</p>
                    </td>
                    <td className="p-4">
                      <SubscriptionBadge state={c.billingState} dias={c.diasRestantes} />
                    </td>
                    <td className="p-4 text-white/70">{fecha(c.subscriptionExpiresAt)}</td>
                    <td className="p-4 text-white/70">
                      {c.ultimoPago ? (
                        <>
                          <p>{plata(c.ultimoPago.amount)}</p>
                          <p className="text-white/40 text-xs">{fecha(c.ultimoPago.paidAt)}</p>
                        </>
                      ) : (
                        <span className="text-white/25">Sin pagos</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={c.isActive === false ? 'text-rose-400' : 'text-emerald-400'}>
                        {c.isActive === false ? 'Suspendido' : 'Activo'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <ChevronRight className="inline text-white/30" size={18} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
