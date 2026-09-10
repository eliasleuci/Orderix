import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Toast, { ToastType } from '../../components/Toast';
import DataState from './components/DataState';
import SubscriptionBadge from './components/SubscriptionBadge';
import TenantFormModal from './components/TenantFormModal';
import { superadminService } from '../../services/superadminService';
import type { SuperAdminTenant, BillingState } from '../../types/superadmin';

type Filtro = 'todos' | 'activos' | 'suspendidos' | 'vencidos';

export default function TenantsPage() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await superadminService.getTenants();
    if (error) {
      setLoadError(error);
      setTenants([]);
    } else {
      setLoadError(null);
      setTenants(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const resumen = useMemo(
    () => ({
      total: tenants.length,
      activos: tenants.filter((t) => t.isActive !== false).length,
      suspendidos: tenants.filter((t) => t.isActive === false).length,
      vencidos: tenants.filter((t) => t.billingState === 'VENCIDO').length,
      porVencer: tenants.filter((t) => t.billingState === 'POR_VENCER').length,
    }),
    [tenants]
  );

  const filtrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tenants.filter((t) => {
      if (q && !`${t.name} ${t.slug} ${t.email ?? ''}`.toLowerCase().includes(q)) return false;
      if (filtro === 'activos') return t.isActive !== false;
      if (filtro === 'suspendidos') return t.isActive === false;
      if (filtro === 'vencidos') return t.billingState === 'VENCIDO';
      return true;
    });
  }, [tenants, searchTerm, filtro]);

  const handleCreate = async (payload: any) => {
    setActionLoading(true);
    const { data, error } = await superadminService.createTenant(payload);
    setActionLoading(false);

    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(`Cliente "${data?.name}" creado`, 'success');
    setIsCreateOpen(false);
    fetchTenants();
  };

  const tarjetas: Array<{ label: string; valor: number; icon: any; color: string; filtro: Filtro }> = [
    { label: 'Clientes', valor: resumen.total, icon: Building2, color: 'text-indigo-400', filtro: 'todos' },
    { label: 'Activos', valor: resumen.activos, icon: CheckCircle2, color: 'text-emerald-400', filtro: 'activos' },
    { label: 'Suspendidos', valor: resumen.suspendidos, icon: XCircle, color: 'text-rose-400', filtro: 'suspendidos' },
    { label: 'Vencidos', valor: resumen.vencidos, icon: Clock, color: 'text-orange-400', filtro: 'vencidos' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Clientes</h1>
          <p className="text-white/50 font-medium mt-2">
            Todos los negocios que usan Orderix
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} leftIcon={<Plus size={18} />}>
          Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tarjetas.map((t) => {
          const activa = filtro === t.filtro;
          return (
            <button
              key={t.label}
              onClick={() => setFiltro(t.filtro)}
              className={`text-left rounded-3xl border p-5 transition-colors ${
                activa
                  ? 'bg-indigo-500/10 border-indigo-500/40'
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <t.icon className={t.color} size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  {t.label}
                </span>
              </div>
              <p className="text-3xl font-black text-white mt-2">{t.valor}</p>
            </button>
          );
        })}
      </div>

      {resumen.porVencer > 0 && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-sm text-orange-200">
          {resumen.porVencer === 1
            ? '1 cliente vence en los próximos 15 días.'
            : `${resumen.porVencer} clientes vencen en los próximos 15 días.`}{' '}
          <button onClick={() => navigate('/superadmin/facturacion')} className="underline font-bold">
            Ver facturación
          </button>
        </div>
      )}

      <Card variant="solid" padding="none">
        <div className="p-5 border-b border-white/5">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            <input
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3
                         text-white placeholder:text-white/25 outline-none focus:border-indigo-500/60"
              placeholder="Buscar por nombre, identificador o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-widest font-bold text-white/50">
                <th className="p-4 pl-6">Cliente</th>
                <th className="p-4">Sucursales</th>
                <th className="p-4">Usuarios</th>
                <th className="p-4">Suscripción</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 pr-6" />
              </tr>
            </thead>
            <tbody>
              <DataState
                loading={loading}
                error={loadError}
                empty={filtrados.length === 0}
                emptyMessage={
                  searchTerm || filtro !== 'todos'
                    ? 'Ningún cliente coincide con el filtro'
                    : 'Todavía no hay clientes registrados'
                }
                onRetry={fetchTenants}
                colSpan={6}
              />

              {!loading &&
                !loadError &&
                filtrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/superadmin/clientes/${t.id}`)}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="p-4 pl-6">
                      <p className="font-black text-white">{t.name}</p>
                      <p className="text-white/40 font-mono text-xs mt-0.5">{t.slug}</p>
                    </td>
                    <td className="p-4 text-white/70">{t._count?.branches ?? 0}</td>
                    <td className="p-4 text-white/70">{t._count?.users ?? 0}</td>
                    <td className="p-4">
                      <SubscriptionBadge state={t.billingState as BillingState} dias={t.diasRestantes} />
                      {t.subscriptionExpiresAt && (
                        <p className="text-white/40 text-xs mt-1">
                          hasta {new Date(t.subscriptionExpiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          t.isActive !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.isActive !== false ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        />
                        {t.isActive !== false ? 'Activo' : 'Suspendido'}
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

      <TenantFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={actionLoading}
      />

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
