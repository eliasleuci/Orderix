import React, { useState } from 'react';
import { Bike, Check, UserX } from 'lucide-react';
import { deliveryService, Repartidor } from '../../../services/deliveryService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pedido a asignar. Null cierra el modal. */
  pedido: { id: string; customer_name?: string | null; customer_address?: string | null; delivery_driver_id?: string | null } | null;
  repartidores: Repartidor[];
  /** Se llama con el id asignado (o null si se quitó) una vez guardado. */
  onAsignado: (driverId: string | null, nombre: string | null) => void;
  onError: (mensaje: string) => void;
  title?: string;
}

const AsignarRepartidorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  pedido,
  repartidores,
  onAsignado,
  onError,
  title = '¿Quién lo lleva?',
}) => {
  const [guardando, setGuardando] = useState(false);

  const asignar = async (driverId: string | null) => {
    if (!pedido) return;
    setGuardando(true);
    const { error } = await deliveryService.asignarRepartidor(pedido.id, driverId);
    setGuardando(false);

    if (error) {
      onError('No se pudo guardar el repartidor');
      return;
    }
    onAsignado(driverId, driverId ? repartidores.find((r) => r.id === driverId)?.name ?? null : null);
    onClose();
  };

  const asignado = pedido?.delivery_driver_id ?? null;

  return (
    <Modal isOpen={isOpen} onClose={() => !guardando && onClose()} title={title} maxWidth="sm">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
          <Bike size={20} className="text-warning shrink-0" />
          <div className="min-w-0">
            <p className="font-black tracking-tight truncate">{pedido?.customer_name || 'Envío'}</p>
            {pedido?.customer_address && (
              <p className="text-xs text-text-secondary truncate">{pedido.customer_address}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {repartidores.map((r) => {
            const actual = r.id === asignado;
            return (
              <button
                key={r.id}
                disabled={guardando}
                onClick={() => asignar(r.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 disabled:opacity-50 ${
                  actual
                    ? 'border-primary bg-primary/10'
                    : 'border-border-subtle bg-surface-elevated/50 hover:border-primary/40'
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-black text-text-primary truncate">{r.name}</span>
                  {r.phone && <span className="block text-xs text-text-muted mt-0.5">{r.phone}</span>}
                </span>
                {actual && <Check size={20} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Sólo si hay alguien asignado: sirve para corregir una asignación
            equivocada sin tener que elegir a otro. */}
        {asignado && (
          <Button
            variant="ghost"
            fullWidth
            disabled={guardando}
            onClick={() => asignar(null)}
            leftIcon={<UserX size={18} />}
          >
            Quitar repartidor
          </Button>
        )}

        <Button variant="ghost" fullWidth disabled={guardando} onClick={onClose}>
          {asignado ? 'Cancelar' : 'Después'}
        </Button>
      </div>
    </Modal>
  );
};

export default AsignarRepartidorModal;
