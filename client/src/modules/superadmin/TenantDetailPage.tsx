import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Store, Users, CreditCard, ShieldAlert, Pencil, Trash2,
  Power, KeyRound, Mail, Phone, MapPin, Loader2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Toast, { ToastType } from '../../components/Toast';
import DataState from './components/DataState';
import SubscriptionBadge from './components/SubscriptionBadge';
import TenantFormModal from './components/TenantFormModal';
import BranchFormModal from './components/BranchFormModal';
import UserFormModal from './components/UserFormModal';
import PaymentModal from './components/PaymentModal';
import DeleteTenantModal from './components/DeleteTenantModal';
import { superadminService } from '../../services/superadminService';
import { ROLE_LABELS } from '../../types/superadmin';
import type {
  TenantDetail, SuperAdminBranch, SuperAdminUser, TenantPayment,
} from '../../types/superadmin';

type Tab = 'sucursales' | 'usuarios' | 'facturacion' | 'peligro';

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'sucursales', label: 'Sucursales', icon: Store },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'facturacion', label: 'Facturación', icon: CreditCard },
  { id: 'peligro', label: 'Zona de peligro', icon: ShieldAlert },
];

const fecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : '—';

const plata = (v: string | number | null) =>
  v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-AR')}`;

export default function TenantDetailPage() {
  const { tenantId = '' } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [branches, setBranches] = useState<SuperAdminBranch[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [payments, setPayments] = useState<TenantPayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sucursales');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [editTenant, setEditTenant] = useState(false);
  const [branchModal, setBranchModal] = useState<{ open: boolean; branch: SuperAdminBranch | null }>({ open: false, branch: null });
  const [userModal, setUserModal] = useState<{ open: boolean; user: SuperAdminUser | null }>({ open: false, user: null });
  const [payModal, setPayModal] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onOk: () => Promise<void> } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const cargar = useCallback(async () => {
    setLoading(true);
    const [t, b, u, p] = await Promise.all([
      superadminService.getTenant(tenantId),
      superadminService.getBranches(tenantId),
      superadminService.getUsers(tenantId),
      superadminService.getPayments(tenantId),
    ]);

    if (t.error) {
      setLoadError(t.error);
    } else {
      setLoadError(null);
      setTenant(t.data);
    }
    setBranches(b.data ?? []);
    setUsers(u.data ?? []);
    setPayments(p.data ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Ejecuta una acción del servicio y refresca, con toast unificado. */
  const accion = async (
    fn: () => Promise<{ data: any; error: string | null }>,
    exito: string
  ) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      showToast(error, 'error');
      return false;
    }
    showToast(exito, 'success');
    await cargar();
    return true;
  };

  const huerfanos = useMemo(() => users.filter((u) => u.tieneCuenta === false), [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (loadError || !tenant) {
    return (
      <Card variant="solid">
        <div className="text-center py-10 space-y-4">
          <p className="text-red-400 font-black uppercase tracking-wider text-sm">
            No se pudo cargar el cliente
          </p>
          <p className="text-white/50 text-sm">{loadError}</p>
          <Button variant="secondary" onClick={cargar}>Reintentar</Button>
        </div>
      </Card>
    );
  }

  const suspendido = tenant.isActive === false;

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate('/superadmin/clientes')}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors"
      >
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-black tracking-tighter text-white">{tenant.name}</h1>
            <SubscriptionBadge state={tenant.billingState} dias={tenant.diasRestantes} />
            {suspendido && <Badge variant="danger">Suspendido</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-white/50">
            <span className="font-mono">{tenant.slug}</span>
            {tenant.email && <span className="flex items-center gap-1.5"><Mail size={14} />{tenant.email}</span>}
            {tenant.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{tenant.phone}</span>}
            <span>Alta {fecha(tenant.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditTenant(true)} leftIcon={<Pencil size={16} />}>
            Editar
          </Button>
          <Button
            variant={suspendido ? 'success' : 'danger'}
            leftIcon={<Power size={16} />}
            onClick={() =>
              setConfirm({
                title: suspendido ? 'Reactivar cliente' : 'Suspender cliente',
                message: suspendido
                  ? `${tenant.name} vuelve a tener acceso al sistema.`
                  : `${tenant.name} pierde el acceso. Los datos quedan intactos y podés reactivarlo cuando quieras.`,
                onOk: async () => {
                  await accion(
                    () => superadminService.setTenantStatus(tenant.id, suspendido),
                    suspendido ? 'Cliente reactivado' : 'Cliente suspendido'
                  );
                },
              })
            }
          >
            {suspendido ? 'Reactivar' : 'Suspender'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-wider
                        border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.id === 'sucursales' && <span className="text-white/30">{branches.length}</span>}
            {t.id === 'usuarios' && <span className="text-white/30">{users.length}</span>}
          </button>
        ))}
      </div>

      {/* ---------- SUCURSALES ---------- */}
      {tab === 'sucursales' && (
        <Card variant="solid" padding="none">
          <div className="p-5 flex items-center justify-between border-b border-white/5">
            <p className="text-white/50 text-sm">
              Cada sucursal tiene su propia dirección y contacto
            </p>
            <Button onClick={() => setBranchModal({ open: true, branch: null })} leftIcon={<Plus size={16} />}>
              Nueva sucursal
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-xs uppercase tracking-widest font-bold text-white/50">
                  <th className="p-4 pl-6">Sucursal</th>
                  <th className="p-4">Contacto</th>
                  <th className="p-4">Usuarios</th>
                  <th className="p-4">Ventas</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <DataState
                  loading={false}
                  error={null}
                  empty={branches.length === 0}
                  emptyMessage="Este cliente no tiene sucursales"
                  onRetry={cargar}
                  colSpan={6}
                />
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="p-4 pl-6">
                      <p className="font-black text-white">{b.name}</p>
                      {b.location && (
                        <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                          <MapPin size={12} />{b.location}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-white/60 text-sm">
                      {b.email && <p>{b.email}</p>}
                      {b.phone && <p className="text-white/40">{b.phone}</p>}
                      {!b.email && !b.phone && <span className="text-white/25">—</span>}
                    </td>
                    <td className="p-4 text-white/70">{b._count?.users ?? 0}</td>
                    <td className="p-4 text-white/70">{b._count?.orders ?? 0}</td>
                    <td className="p-4 text-center">
                      <Badge variant={b.isActive === false ? 'danger' : 'success'}>
                        {b.isActive === false ? 'Inactiva' : 'Activa'}
                      </Badge>
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={() => setBranchModal({ open: true, branch: b })}>
                          <Pencil size={15} className="text-white/50" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            accion(
                              () => superadminService.setBranchStatus(b.id, b.isActive === false),
                              b.isActive === false ? 'Sucursal reactivada' : 'Sucursal desactivada'
                            )
                          }
                        >
                          <Power size={15} className={b.isActive === false ? 'text-emerald-400' : 'text-orange-400'} />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setConfirm({
                              title: `Borrar "${b.name}"`,
                              message:
                                'Sólo se puede borrar una sucursal vacía. Si tiene ventas, usuarios o productos, desactivala en su lugar.',
                              onOk: async () => {
                                await accion(() => superadminService.deleteBranch(b.id), 'Sucursal borrada');
                              },
                            })
                          }
                        >
                          <Trash2 size={15} className="text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---------- USUARIOS ---------- */}
      {tab === 'usuarios' && (
        <Card variant="solid" padding="none">
          <div className="p-5 flex items-center justify-between border-b border-white/5">
            <p className="text-white/50 text-sm">Quién puede entrar y con qué permisos</p>
            <Button
              onClick={() => setUserModal({ open: true, user: null })}
              leftIcon={<Plus size={16} />}
              disabled={branches.length === 0}
            >
              Nuevo usuario
            </Button>
          </div>

          {huerfanos.length > 0 && (
            <div className="mx-5 mt-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              {huerfanos.length === 1 ? '1 perfil no tiene' : `${huerfanos.length} perfiles no tienen`} cuenta
              de acceso: quedaron de borrados anteriores y no pueden iniciar sesión. Podés darlos de baja.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-xs uppercase tracking-widest font-bold text-white/50">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Sucursal</th>
                  <th className="p-4">Último ingreso</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <DataState
                  loading={false}
                  error={null}
                  empty={users.length === 0}
                  emptyMessage="Este cliente no tiene usuarios"
                  onRetry={cargar}
                  colSpan={5}
                />
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="p-4 pl-6">
                      <p className="font-bold text-white">{u.email}</p>
                      {u.name && <p className="text-white/40 text-xs mt-0.5">{u.name}</p>}
                      {u.tieneCuenta === false && (
                        <Badge variant="warning" size="sm" className="mt-1">Sin cuenta de acceso</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant={u.role === 'ADMIN' ? 'primary' : 'neutral'}>
                        {ROLE_LABELS[u.role ?? ''] ?? u.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-white/60 text-sm">{u.branchName ?? '—'}</td>
                    <td className="p-4 text-white/50 text-sm">{fecha(u.lastSignInAt)}</td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={() => setUserModal({ open: true, user: u })}>
                          <Pencil size={15} className="text-white/50" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const nueva = window.prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres)`);
                            if (!nueva) return;
                            accion(() => superadminService.setUserPassword(u.id, nueva), 'Contraseña actualizada');
                          }}
                        >
                          <KeyRound size={15} className="text-white/50" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setConfirm({
                              title: `Dar de baja a ${u.email}`,
                              message: 'Se elimina su cuenta y pierde el acceso de inmediato. No se puede deshacer.',
                              onOk: async () => {
                                await accion(() => superadminService.deleteUser(u.id), 'Usuario dado de baja');
                              },
                            })
                          }
                        >
                          <Trash2 size={15} className="text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---------- FACTURACIÓN ---------- */}
      {tab === 'facturacion' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card variant="solid">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Estado</p>
              <div className="mt-3">
                <SubscriptionBadge state={tenant.billingState} dias={tenant.diasRestantes} />
              </div>
            </Card>
            <Card variant="solid">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Pagado hasta</p>
              <p className="text-2xl font-black text-white mt-2">{fecha(tenant.subscriptionExpiresAt)}</p>
            </Card>
            <Card variant="solid">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Último pago</p>
              <p className="text-2xl font-black text-white mt-2">
                {payments[0] ? plata(payments[0].amount) : '—'}
              </p>
              {payments[0] && (
                <p className="text-white/40 text-xs mt-1">{fecha(payments[0].paidAt)}</p>
              )}
            </Card>
          </div>

          <Card variant="solid" padding="none">
            <div className="p-5 flex items-center justify-between border-b border-white/5">
              <p className="text-white/50 text-sm">Historial de pagos</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setConfirm({
                      title: 'Marcar como vencido y suspender',
                      message: `${tenant.name} queda marcado como impago y pierde el acceso hasta que registres un pago.`,
                      onOk: async () => {
                        await accion(
                          () => superadminService.updateSubscription(tenant.id, { suspend: true, status: 'EXPIRED' }),
                          'Cliente suspendido por falta de pago'
                        );
                      },
                    })
                  }
                >
                  Marcar impago
                </Button>
                <Button onClick={() => setPayModal(true)} leftIcon={<Plus size={16} />}>
                  Registrar pago
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-xs uppercase tracking-widest font-bold text-white/50">
                    <th className="p-4 pl-6">Fecha</th>
                    <th className="p-4">Monto</th>
                    <th className="p-4">Cubre hasta</th>
                    <th className="p-4">Método</th>
                    <th className="p-4">Registró</th>
                    <th className="p-4 pr-6">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  <DataState
                    loading={false}
                    error={null}
                    empty={payments.length === 0}
                    emptyMessage="Todavía no registraste ningún pago"
                    onRetry={cargar}
                    colSpan={6}
                  />
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="p-4 pl-6 text-white font-bold">{fecha(p.paidAt)}</td>
                      <td className="p-4 text-white">{plata(p.amount)}</td>
                      <td className="p-4 text-white/70">{fecha(p.periodEnd)}</td>
                      <td className="p-4 text-white/60">{p.method ?? '—'}</td>
                      <td className="p-4 text-white/50 text-sm">{p.registradoPor ?? '—'}</td>
                      <td className="p-4 pr-6 text-white/50 text-sm">{p.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ---------- ZONA DE PELIGRO ---------- */}
      {tab === 'peligro' && (
        <Card variant="solid">
          <div className="space-y-8">
            <div>
              <h3 className="font-black text-white uppercase tracking-wider text-sm">Resetear la clave del administrador</h3>
              <p className="text-white/50 text-sm mt-1 mb-3">
                Genera una contraseña nueva para el usuario ADMIN principal de este cliente.
              </p>
              <Button
                variant="secondary"
                leftIcon={<KeyRound size={16} />}
                onClick={() => {
                  const nueva = window.prompt('Nueva contraseña para el administrador (mínimo 8 caracteres)');
                  if (!nueva) return;
                  accion(() => superadminService.resetAdminPassword(tenant.id, nueva), 'Contraseña actualizada');
                }}
              >
                Cambiar contraseña
              </Button>
            </div>

            <div className="border-t border-rose-500/20 pt-8">
              <h3 className="font-black text-rose-400 uppercase tracking-wider text-sm">Borrar definitivamente</h3>
              <p className="text-white/50 text-sm mt-1">
                Elimina el cliente, sus sucursales, usuarios, productos, stock y ventas. No se puede deshacer.
                Para bajas normales usá <strong className="text-white/70">Suspender</strong>, que es reversible.
              </p>

              {!suspendido && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/50">
                  Primero tenés que suspender el cliente. Es un paso deliberado para evitar borrados por error.
                </div>
              )}

              <Button
                variant="danger"
                leftIcon={<Trash2 size={16} />}
                disabled={!suspendido}
                className="mt-4"
                onClick={() => setDeleteOpen(true)}
              >
                Borrar {tenant.name}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---------- Modales ---------- */}
      <TenantFormModal
        isOpen={editTenant}
        onClose={() => setEditTenant(false)}
        tenant={tenant}
        isLoading={busy}
        onSubmit={async (d) => {
          const ok = await accion(() => superadminService.updateTenant(tenant.id, d), 'Cliente actualizado');
          if (ok) setEditTenant(false);
        }}
      />

      <BranchFormModal
        isOpen={branchModal.open}
        branch={branchModal.branch}
        isLoading={busy}
        onClose={() => setBranchModal({ open: false, branch: null })}
        onSubmit={async (d) => {
          const ok = branchModal.branch
            ? await accion(() => superadminService.updateBranch(branchModal.branch!.id, d), 'Sucursal actualizada')
            : await accion(() => superadminService.createBranch(tenant.id, d), 'Sucursal creada');
          if (ok) setBranchModal({ open: false, branch: null });
        }}
      />

      <UserFormModal
        isOpen={userModal.open}
        user={userModal.user}
        branches={branches}
        isLoading={busy}
        onClose={() => setUserModal({ open: false, user: null })}
        onSubmit={async (d) => {
          const ok = userModal.user
            ? await accion(() => superadminService.updateUser(userModal.user!.id, d), 'Usuario actualizado')
            : await accion(() => superadminService.createUser(tenant.id, d), 'Usuario creado');
          if (ok) setUserModal({ open: false, user: null });
        }}
      />

      <PaymentModal
        isOpen={payModal}
        onClose={() => setPayModal(false)}
        vencimientoActual={tenant.subscriptionExpiresAt}
        isLoading={busy}
        onSubmit={async (d) => {
          const ok = await accion(() => superadminService.registerPayment(tenant.id, d), 'Pago registrado');
          if (ok) setPayModal(false);
        }}
      />

      <DeleteTenantModal
        isOpen={deleteOpen}
        tenant={tenant}
        isLoading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async (confirmSlug) => {
          setBusy(true);
          const { data, error } = await superadminService.deleteTenant(tenant.id, confirmSlug);
          setBusy(false);

          if (error) {
            showToast(error, 'error');
            return;
          }
          const fallidos = data?.authFallidos?.length ?? 0;
          showToast(
            fallidos > 0
              ? `Cliente borrado, pero ${fallidos} cuentas quedaron sin eliminar`
              : 'Cliente borrado definitivamente',
            fallidos > 0 ? 'error' : 'success'
          );
          navigate('/superadmin/clientes');
        }}
      />

      <ConfirmModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        isLoading={busy}
        onConfirm={async () => {
          await confirm?.onOk();
          setConfirm(null);
        }}
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
