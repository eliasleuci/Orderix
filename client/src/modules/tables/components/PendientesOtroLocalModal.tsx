import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { tableService, PendienteOtroLocal } from '../../../services/tableService';
import { MEDIOS_DE_PAGO, MedioPago } from '../../../lib/mediosDePago';
import { formatTicketNumber, cn } from '../../../lib/utils';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  localCompartido: string | null;
  onLocalCompartidoGuardado: (nombre: string | null) => void;
  onAviso: (mensaje: string, tipo: 'success' | 'error') => void;
  /** Para refrescar el contador del botón de la pantalla. */
  onCambio: () => void;
}

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Lo que consumieron en mesas que le cobró al cliente el local con el que se
 * comparte el salón. Queda acá hasta que ese local paga.
 */
const PendientesOtroLocalModal: React.FC<Props> = ({
  isOpen,
  onClose,
  localCompartido,
  onLocalCompartidoGuardado,
  onAviso,
  onCambio,
}) => {
  const { branchId, role } = useAuthStore();
  const esAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [pendientes, setPendientes] = useState<PendienteOtroLocal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState<MedioPago>('CASH');
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // En una ref: la pantalla de Mesas crea su función de aviso en cada render, y
  // como dependencia haría recargar la lista (y perder lo marcado) a cada rato.
  const avisoRef = useRef(onAviso);
  avisoRef.current = onAviso;

  const cargar = useCallback(async () => {
    if (!branchId) return;
    setCargando(true);
    const { data, error } = await tableService.getPendientesOtroLocal(branchId);
    setCargando(false);
    if (error) return avisoRef.current(error, 'error');
    setPendientes(data ?? []);
    setSeleccionados(new Set());
  }, [branchId]);

  useEffect(() => {
    if (isOpen) {
      cargar();
      setNombre(localCompartido ?? '');
    }
  }, [isOpen, cargar, localCompartido]);

  const visibles = useMemo(
    () =>
      pendientes.filter((p) => {
        // en-CA da AAAA-MM-DD en hora local, igual que el valor de un input date.
        const dia = new Date(p.fecha).toLocaleDateString('en-CA');
        return (!desde || dia >= desde) && (!hasta || dia <= hasta);
      }),
    [pendientes, desde, hasta]
  );

  const totalVisible = visibles.reduce((s, p) => s + p.total, 0);
  const totalSeleccionado = pendientes.filter((p) => seleccionados.has(p.id)).reduce((s, p) => s + p.total, 0);
  const todosMarcados = visibles.length > 0 && visibles.every((p) => seleccionados.has(p.id));

  const alternar = (id: string) =>
    setSeleccionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const alternarTodos = () =>
    setSeleccionados(todosMarcados ? new Set() : new Set(visibles.map((p) => p.id)));

  const marcarCobrados = async () => {
    if (seleccionados.size === 0) return;
    setGuardando(true);
    const { data, error } = await tableService.marcarCobradosOtroLocal([...seleccionados], medio);
    setGuardando(false);
    if (error) return onAviso(error, 'error');
    onAviso(`${data} ${data === 1 ? 'pedido cobrado' : 'pedidos cobrados'}: entran en la caja de hoy`, 'success');
    onCambio();
    cargar();
  };

  const guardarNombre = async () => {
    const { error } = await tableService.setLocalCompartido(nombre);
    if (error) return onAviso(error, 'error');
    onLocalCompartidoGuardado(nombre.trim() || null);
    onAviso('Guardado', 'success');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pendientes de cobro" maxWidth="md">
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">
          Mesas que le cobró al cliente {localCompartido ? <b>{localCompartido}</b> : 'el otro local'}. No
          figuran como cobradas hasta que ese local te paga; ahí se marcan y entran en la caja de ese día.
        </p>

        {esAdmin && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Local con el que comparten las mesas
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del otro local"
                maxLength={60}
                className="h-11 py-0"
              />
            </div>
            <Button
              variant="secondary"
              className="h-11"
              onClick={guardarNombre}
              disabled={(nombre.trim() || null) === localCompartido}
              leftIcon={<Save size={16} />}
            >
              Guardar
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2.5 text-sm [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2.5 text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-widest text-warning">Te deben</span>
          <span className="text-xl font-black tabular-nums">{plata(totalVisible)}</span>
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No hay pedidos pendientes de cobro.</p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={alternarTodos}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
            {visibles.map((p) => {
              const marcado = seleccionados.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternar(p.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all',
                    marcado ? 'border-primary bg-primary/10' : 'border-border-subtle bg-surface-base hover:border-primary/40'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-md border shrink-0 flex items-center justify-center',
                      marcado ? 'bg-primary border-primary' : 'border-white/20'
                    )}
                  >
                    {marcado && <Check size={13} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">
                      #{formatTicketNumber(p.ticketNumber)} · {p.mesa ?? 'Mesa'}
                    </span>
                    <span className="block text-[11px] text-text-muted truncate">
                      {fecha(p.fecha)}
                      {p.mozo ? ` · ${p.mozo}` : ''}
                    </span>
                  </span>
                  <span className="text-sm font-black tabular-nums shrink-0">{plata(p.total)}</span>
                </button>
              );
            })}
          </div>
        )}

        {seleccionados.size > 0 && (
          <div className="sticky bottom-0 -mx-1 px-1 pt-4 pb-1 bg-surface-elevated border-t border-white/5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">¿Cómo te pagaron?</p>
            <div className="grid grid-cols-4 gap-2">
              {MEDIOS_DE_PAGO.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMedio(m.id)}
                  className={cn(
                    'py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all',
                    medio === m.id ? 'bg-primary text-white border-primary' : 'bg-surface-base border-white/5 text-text-muted'
                  )}
                >
                  {m.corto}
                </button>
              ))}
            </div>
            <Button fullWidth variant="success" onClick={marcarCobrados} isLoading={guardando} leftIcon={<Check size={18} />}>
              Marcar {seleccionados.size} como cobrado · {plata(totalSeleccionado)}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PendientesOtroLocalModal;
