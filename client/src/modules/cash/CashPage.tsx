import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  LockKeyhole,
  LockKeyholeOpen,
  Banknote,
  CreditCard,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  History,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { cashService, Caja, ResumenCaja } from '../../services/cashService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Toast, { ToastType } from '../../components/Toast';

const plata = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const CashPage: React.FC = () => {
  const { role } = useAuthStore();
  const esAdmin = role === 'ADMIN';

  const [caja, setCaja] = useState<Caja | null>(null);
  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [historial, setHistorial] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [modalApertura, setModalApertura] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [montoContado, setMontoContado] = useState('');
  const [notas, setNotas] = useState('');

  // Corrección y borrado de un turno ya cerrado.
  const [corrigiendo, setCorrigiendo] = useState<Caja | null>(null);
  const [contadoCorregido, setContadoCorregido] = useState('');
  const [notasCorregidas, setNotasCorregidas] = useState('');
  const [borrando, setBorrando] = useState<Caja | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await cashService.getActual();
    if (error) setToast({ message: error, type: 'error' });
    setCaja(data?.caja ?? null);
    setResumen(data?.resumen ?? null);

    if (esAdmin) {
      const { data: turnos } = await cashService.getHistorial();
      setHistorial(turnos ?? []);
    }
    setLoading(false);
  }, [esAdmin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esperado = useMemo(() => {
    if (!caja || !resumen) return 0;
    return caja.montoInicial + resumen.ventasEfectivo;
  }, [caja, resumen]);

  // La diferencia se muestra mientras escribe, que es el momento en que sirve:
  // si no cuadra, todavía está a tiempo de volver a contar.
  const diferenciaEnVivo = useMemo(() => {
    const contado = parseFloat(montoContado);
    if (!Number.isFinite(contado)) return null;
    return Math.round((contado - esperado) * 100) / 100;
  }, [montoContado, esperado]);

  const abrir = async () => {
    const monto = parseFloat(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
      setToast({ message: 'Ingresá un monto inicial válido', type: 'error' });
      return;
    }
    setGuardando(true);
    const { error } = await cashService.abrir(monto, notas);
    setGuardando(false);

    if (error) {
      setToast({ message: error, type: 'error' });
      return;
    }
    setModalApertura(false);
    setMontoInicial('');
    setNotas('');
    setToast({ message: 'Caja abierta', type: 'success' });
    cargar();
  };

  const cerrar = async () => {
    const monto = parseFloat(montoContado);
    if (!Number.isFinite(monto) || monto < 0) {
      setToast({ message: 'Ingresá el monto contado', type: 'error' });
      return;
    }
    setGuardando(true);
    const { data, error } = await cashService.cerrar(monto, notas);
    setGuardando(false);

    if (error) {
      setToast({ message: error, type: 'error' });
      return;
    }
    setModalCierre(false);
    setMontoContado('');
    setNotas('');

    const dif = data!.caja.diferencia ?? 0;
    setToast({
      message:
        dif === 0
          ? 'Caja cerrada, cuadra exacto'
          : `Caja cerrada con ${dif > 0 ? 'sobrante' : 'faltante'} de ${plata(Math.abs(dif))}`,
      type: dif === 0 ? 'success' : 'error',
    });
    cargar();
  };

  const abrirCorreccion = (t: Caja) => {
    setCorrigiendo(t);
    setContadoCorregido(String(t.montoContado ?? 0));
    setNotasCorregidas(t.notasCierre ?? '');
  };

  const guardarCorreccion = async () => {
    if (!corrigiendo) return;
    const monto = parseFloat(contadoCorregido);
    if (!Number.isFinite(monto) || monto < 0) {
      setToast({ message: 'Ingresá un monto válido', type: 'error' });
      return;
    }

    setGuardando(true);
    const { error } = await cashService.corregir(corrigiendo.id, monto, notasCorregidas);
    setGuardando(false);

    if (error) {
      setToast({ message: error, type: 'error' });
      return;
    }
    setCorrigiendo(null);
    setToast({ message: 'Turno corregido', type: 'success' });
    cargar();
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const { error } = await cashService.eliminar(borrando.id);
    setBorrando(null);

    if (error) {
      setToast({ message: error, type: 'error' });
      return;
    }
    setToast({ message: 'Turno eliminado', type: 'success' });
    cargar();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-4 lg:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 hidden lg:block w-[900px] h-[900px] bg-primary/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="mb-10 relative z-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Wallet size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Caja</h1>
        </div>
        <p className="text-text-muted text-sm font-medium ml-1">
          Apertura con monto inicial y cierre con arqueo
        </p>
      </header>

      <div className="relative z-10 space-y-8 max-w-5xl">
        {!caja ? (
          <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center mx-auto mb-6">
              <LockKeyhole size={36} className="text-text-muted" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Caja cerrada</h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-8">
              Abrí la caja con el dinero que hay en el cajón para empezar el turno.
              Al cerrar vas a poder comparar lo contado contra lo que debería haber.
            </p>
            <Button size="lg" leftIcon={<LockKeyholeOpen size={20} />} onClick={() => setModalApertura(true)}>
              Abrir caja
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-success/20 bg-success/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <div>
                  <p className="font-black uppercase tracking-widest text-xs text-success">Caja abierta</p>
                  <p className="text-text-secondary text-xs mt-0.5">
                    Desde {fecha(caja.abiertaEn)}
                    {caja.abiertaPor ? ` · ${caja.abiertaPor}` : ''}
                  </p>
                </div>
              </div>
              <Button variant="danger" leftIcon={<LockKeyhole size={18} />} onClick={() => setModalCierre(true)}>
                Cerrar caja
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 w-fit mb-4">
                  <Wallet className="text-text-secondary" size={24} />
                </div>
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Monto inicial</h3>
                <span className="text-3xl font-black tracking-tighter leading-none block mt-1">
                  {plata(caja.montoInicial)}
                </span>
                <p className="text-[10px] font-bold text-text-muted mt-2">Fondo con el que se abrió</p>
              </Card>

              <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
                <div className="p-3 rounded-2xl bg-success/10 border border-success/20 w-fit mb-4">
                  <Banknote className="text-success" size={24} />
                </div>
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Ventas en efectivo</h3>
                <span className="text-3xl font-black text-success tracking-tighter leading-none block mt-1">
                  {plata(resumen?.ventasEfectivo ?? 0)}
                </span>
                <p className="text-[10px] font-bold text-text-muted mt-2">
                  {resumen?.cantidadPedidos ?? 0} pedidos cobrados en el turno
                </p>
              </Card>

              <Card variant="solid" padding="large" className="border-primary/20 bg-primary/5">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 w-fit mb-4">
                  <TrendingUp className="text-primary" size={24} />
                </div>
                <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Debería haber</h3>
                <span className="text-3xl font-black text-primary tracking-tighter leading-none block mt-1">
                  {plata(esperado)}
                </span>
                <p className="text-[10px] font-bold text-text-muted mt-2">Inicial + ventas en efectivo</p>
              </Card>
            </div>

            <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shrink-0">
                  <CreditCard size={26} className="text-text-secondary" />
                </div>
                <div>
                  <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    Tarjeta / QR / Transferencia
                  </h3>
                  <span className="text-2xl font-black tracking-tighter leading-none block mt-1">
                    {plata(resumen?.ventasElectronicas ?? 0)}
                  </span>
                  <p className="text-[10px] font-bold text-text-muted mt-1">
                    No entra al cajón, no cuenta para el arqueo
                  </p>
                </div>
              </div>
            </Card>

            {(resumen?.sinCobrar.cantidad ?? 0) > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4">
                <Clock size={20} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-warning">
                    {plata(resumen!.sinCobrar.total)} en mesas abiertas
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {resumen!.sinCobrar.cantidad}{' '}
                    {resumen!.sinCobrar.cantidad === 1 ? 'pedido todavía sin cobrar' : 'pedidos todavía sin cobrar'}.
                    Esa plata no está en el cajón, así que no cuenta para el arqueo hasta que se cierre la cuenta.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {esAdmin && historial.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <History size={20} className="text-text-muted" />
              <h2 className="text-xl font-black uppercase tracking-tighter">Turnos anteriores</h2>
            </div>

            <div className="space-y-3">
              {historial.map((t) => {
                const dif = t.diferencia ?? 0;
                const cuadra = dif === 0;
                const sobra = dif > 0;
                return (
                  <Card
                    key={t.id}
                    variant="solid"
                    padding="normal"
                    className="border-white/5 bg-surface-elevated/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-black tracking-tight">
                        {fecha(t.abiertaEn)} → {t.cerradaEn ? fecha(t.cerradaEn) : '—'}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Inicial {plata(t.montoInicial)} · Efectivo {plata(t.ventasEfectivo ?? 0)} · Contado{' '}
                        {plata(t.montoContado ?? 0)}
                        {t.cerradaPor ? ` · ${t.cerradaPor}` : ''}
                      </p>
                      {t.notasCierre && (
                        <p className="text-xs text-text-secondary mt-1 italic">{t.notasCierre}</p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-black text-sm ${
                          cuadra
                            ? 'bg-success/10 border-success/20 text-success'
                            : sobra
                              ? 'bg-primary/10 border-primary/20 text-primary'
                              : 'bg-danger/10 border-danger/20 text-danger'
                        }`}
                      >
                        {cuadra ? (
                          <>
                            <CheckCircle2 size={16} /> Cuadra
                          </>
                        ) : (
                          <>
                            {sobra ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {sobra ? 'Sobrante' : 'Faltante'} {plata(Math.abs(dif))}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => abrirCorreccion(t)}
                        title="Corregir lo contado"
                        className="p-2.5 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setBorrando(t)}
                        title="Eliminar turno"
                        className="p-2.5 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalApertura}
        onClose={() => !guardando && setModalApertura(false)}
        title="Abrir caja"
        maxWidth="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            Contá el dinero que hay en el cajón antes de empezar a vender y anotalo acá.
          </p>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
              Monto inicial
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              className="h-14 text-2xl font-black"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
              Nota (opcional)
            </label>
            <Input
              placeholder="Turno mañana, caja 1..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setModalApertura(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={abrir} isLoading={guardando} leftIcon={<LockKeyholeOpen size={18} />}>
              Abrir caja
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalCierre}
        onClose={() => !guardando && setModalCierre(false)}
        title="Cerrar caja"
        maxWidth="sm"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Debería haber</p>
            <p className="text-3xl font-black text-primary tracking-tighter leading-none mt-1">{plata(esperado)}</p>
            <p className="text-xs text-text-secondary mt-2">
              {plata(caja?.montoInicial ?? 0)} de inicial + {plata(resumen?.ventasEfectivo ?? 0)} en efectivo
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
              Monto contado
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={montoContado}
              onChange={(e) => setMontoContado(e.target.value)}
              className="h-14 text-2xl font-black"
              autoFocus
            />
          </div>

          {diferenciaEnVivo !== null && (
            <div
              className={`rounded-2xl border px-5 py-4 ${
                diferenciaEnVivo === 0
                  ? 'border-success/20 bg-success/10'
                  : diferenciaEnVivo > 0
                    ? 'border-primary/20 bg-primary/10'
                    : 'border-danger/20 bg-danger/10'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Diferencia</p>
              <p
                className={`text-2xl font-black tracking-tighter leading-none mt-1 ${
                  diferenciaEnVivo === 0
                    ? 'text-success'
                    : diferenciaEnVivo > 0
                      ? 'text-primary'
                      : 'text-danger'
                }`}
              >
                {diferenciaEnVivo === 0
                  ? 'Cuadra exacto'
                  : `${diferenciaEnVivo > 0 ? 'Sobran' : 'Faltan'} ${plata(Math.abs(diferenciaEnVivo))}`}
              </p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
              Nota (opcional)
            </label>
            <Input
              placeholder="Se pagó un flete con la caja..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setModalCierre(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={cerrar} isLoading={guardando} leftIcon={<LockKeyhole size={18} />}>
              Cerrar caja
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(corrigiendo)}
        onClose={() => !guardando && setCorrigiendo(null)}
        title="Corregir turno"
        maxWidth="sm"
      >
        {corrigiendo && (
          <div className="space-y-5">
            {/* Lo esperado no se puede tocar: salió de los pedidos del turno.
                Lo único que puede estar mal es lo que alguien contó a mano. */}
            <div className="rounded-2xl border border-white/5 bg-surface-base px-5 py-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                Debería haber
              </p>
              <p className="text-2xl font-black text-primary tracking-tighter leading-none">
                {plata(corrigiendo.montoEsperado ?? 0)}
              </p>
              <p className="text-xs text-text-secondary pt-1">
                {plata(corrigiendo.montoInicial)} de inicial + {plata(corrigiendo.ventasEfectivo ?? 0)} en
                efectivo. Esto sale de las ventas del turno y no se edita.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Monto contado
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={contadoCorregido}
                onChange={(e) => setContadoCorregido(e.target.value)}
                className="h-14 text-2xl font-black"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Nota
              </label>
              <Input
                placeholder="Motivo de la corrección..."
                value={notasCorregidas}
                onChange={(e) => setNotasCorregidas(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCorrigiendo(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={guardarCorreccion} isLoading={guardando} leftIcon={<Save size={18} />}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrado}
        title="Eliminar turno"
        message={
          borrando
            ? `Se elimina el arqueo del ${fecha(borrando.abiertaEn)}. Las ventas de ese turno no se tocan: lo que se borra es el registro de cuánto se contó en el cajón. Si fue una prueba, adelante; si fue un turno real, perdés el respaldo de ese arqueo.`
            : ''
        }
        confirmText="Eliminar"
      />

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default CashPage;
