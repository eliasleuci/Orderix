import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Phone, UserRound, Percent, Check, X } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { tableService, Mozo } from '../../../services/tableService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Se avisa al cerrar para que la pantalla recargue la lista de mesas. */
  onCambios: () => void;
  onAviso: (mensaje: string, tipo: 'success' | 'error') => void;
}

const MozosModal: React.FC<Props> = ({ isOpen, onClose, onCambios, onAviso }) => {
  const { branchId, tenantId, role } = useAuthStore();
  const esAdmin = role === 'ADMIN';

  const [mozos, setMozos] = useState<Mozo[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '', comision: '' });
  const [editando, setEditando] = useState<Mozo | null>(null);
  const [comisionEditada, setComisionEditada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [hubocambios, setHuboCambios] = useState(false);

  const cargar = useCallback(async () => {
    if (!branchId) return;
    setCargando(true);
    const { data } = await tableService.getMozos(branchId, true);
    setMozos(data ?? []);
    setCargando(false);
  }, [branchId]);

  useEffect(() => {
    if (isOpen) cargar();
  }, [isOpen, cargar]);

  const cerrar = () => {
    if (hubocambios) onCambios();
    setHuboCambios(false);
    onClose();
  };

  /** Comisión vacía o inválida = 0. El local puede no pagar comisión. */
  const aPorcentaje = (texto: string) => {
    const n = parseFloat(texto);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, 100);
  };

  const agregar = async () => {
    const nombre = nuevo.nombre.trim();
    if (!nombre) return onAviso('Poné el nombre del mozo', 'error');

    const { error } = await tableService.crearMozo({
      tenant_id: tenantId!,
      branch_id: branchId!,
      name: nombre,
      phone: nuevo.telefono.trim() || null,
      commission_pct: aPorcentaje(nuevo.comision),
    });
    if (error) return onAviso(error, 'error');

    setNuevo({ nombre: '', telefono: '', comision: '' });
    setHuboCambios(true);
    onAviso('Mozo agregado', 'success');
    cargar();
  };

  const guardarComision = async () => {
    if (!editando) return;
    const { error } = await tableService.actualizarMozo(editando.id, {
      commission_pct: aPorcentaje(comisionEditada),
    });
    if (error) return onAviso(error, 'error');

    setEditando(null);
    setHuboCambios(true);
    onAviso('Comisión actualizada', 'success');
    cargar();
  };

  const alternar = async (m: Mozo) => {
    const { error } = await tableService.actualizarMozo(m.id, { is_active: !m.is_active });
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Mozos" maxWidth="sm">
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">
          Se eligen al abrir una mesa. La comisión es el porcentaje que cobra el mozo
          sobre lo que vende, y se ve liquidada en el Financiero.
        </p>

        {esAdmin ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Nombre"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              className="flex-1"
            />
            <Input
              placeholder="Teléfono"
              value={nuevo.telefono}
              onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              className="sm:w-32"
            />
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.5"
              placeholder="% com."
              value={nuevo.comision}
              onChange={(e) => setNuevo({ ...nuevo, comision: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              className="sm:w-28"
            />
            <Button leftIcon={<Plus size={18} />} onClick={agregar}>
              Sumar
            </Button>
          </div>
        ) : (
          // El alta de personal la define el dueño; la base lo bloquea igual con
          // RLS, así que mostrar los botones sólo llevaría a un error.
          <p className="text-xs text-text-muted italic">
            Sólo el dueño puede dar de alta o de baja mozos.
          </p>
        )}

        {cargando ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mozos.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">Todavía no hay mozos cargados.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-none">
            {mozos.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-base px-4 py-3 ${
                  m.is_active ? '' : 'opacity-50'
                }`}
              >
                <UserRound size={18} className="text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-black tracking-tight truncate">{m.name}</p>
                  {m.phone && (
                    <p className="text-xs text-text-muted mt-0.5 inline-flex items-center gap-1.5">
                      <Phone size={12} /> {m.phone}
                    </p>
                  )}
                  {!m.is_active && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mt-0.5">
                      Inactivo
                    </p>
                  )}
                </div>

                {editando?.id === m.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.5"
                      value={comisionEditada}
                      onChange={(e) => setComisionEditada(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guardarComision()}
                      className="w-24 py-2 px-3"
                      autoFocus
                    />
                    <button
                      onClick={guardarComision}
                      title="Guardar"
                      className="p-2 rounded-xl text-success hover:bg-success/10 transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      title="Cancelar"
                      className="p-2 rounded-xl text-text-muted hover:bg-white/5 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        if (!esAdmin) return;
                        setEditando(m);
                        setComisionEditada(String(m.commission_pct ?? 0));
                      }}
                      title={esAdmin ? 'Cambiar comisión' : undefined}
                      className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-black transition-colors ${
                        Number(m.commission_pct) > 0 ? 'text-primary' : 'text-text-muted'
                      } ${esAdmin ? 'hover:bg-white/5' : 'cursor-default'}`}
                    >
                      {Number(m.commission_pct ?? 0)}
                      <Percent size={13} />
                    </button>

                    {esAdmin && (
                      <button
                        onClick={() => alternar(m)}
                        className="px-3 py-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest"
                      >
                        {m.is_active ? 'Pausar' : 'Activar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {esAdmin && mozos.length > 0 && (
          <p className="text-[10px] text-text-muted leading-snug">
            Un mozo que se va se pausa, no se borra: sus pedidos ya vendidos guardan
            quién los atendió y borrarlo perdería el historial de comisiones.
          </p>
        )}

        <Button variant="ghost" fullWidth onClick={cerrar}>
          Listo
        </Button>
      </div>
    </Modal>
  );
};

export default MozosModal;
