import React, { useState } from 'react';
import { UserRound, Check, UserX } from 'lucide-react';
import { tableService, Table, Mozo } from '../../../services/tableService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
  mozos: Mozo[];
  onAsignado: (nombre: string | null) => void;
  onError: (mensaje: string) => void;
}

/**
 * Cambiar el mozo de una mesa ya abierta. Antes esto sólo se podía desde
 * "Editar Mesa", que por el nombre parece el lugar donde se cambia el número y
 * la capacidad: nadie lo iba a buscar ahí en el medio del servicio.
 */
const AsignarMozoModal: React.FC<Props> = ({ isOpen, onClose, table, mozos, onAsignado, onError }) => {
  const [guardando, setGuardando] = useState(false);

  const asignar = async (waiterId: string | null) => {
    if (!table) return;
    setGuardando(true);
    const { error } = await tableService.updateTable(table.id, { waiter_id: waiterId });
    setGuardando(false);

    if (error) return onError(error);
    onAsignado(waiterId ? mozos.find((m) => m.id === waiterId)?.name ?? null : null);
    onClose();
  };

  const asignado = table?.waiter_id ?? null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !guardando && onClose()}
      title={asignado ? 'Cambiar mozo' : '¿Quién atiende la mesa?'}
      maxWidth="sm"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
          <p className="font-black tracking-tight">
            {table?.label || `Mesa ${table?.number}`}
          </p>
          {table?.customer_name && (
            <p className="text-xs text-text-secondary mt-0.5">{table.customer_name}</p>
          )}
        </div>

        {mozos.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-6">
            Todavía no hay mozos cargados. Se cargan con el botón <b>Mozos</b>, arriba
            en esta misma pantalla.
          </p>
        ) : (
          <div className="space-y-2">
            {mozos.map((m) => {
              const actual = m.id === asignado;
              return (
                <button
                  key={m.id}
                  disabled={guardando}
                  onClick={() => asignar(m.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 disabled:opacity-50 ${
                    actual
                      ? 'border-primary bg-primary/10'
                      : 'border-border-subtle bg-surface-elevated/50 hover:border-primary/40'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <UserRound size={18} className="text-text-muted shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-black text-text-primary truncate">{m.name}</span>
                      {Number(m.commission_pct) > 0 && (
                        <span className="block text-xs text-text-muted mt-0.5">
                          {Number(m.commission_pct)}% de comisión
                        </span>
                      )}
                    </span>
                  </span>
                  {actual && <Check size={20} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {asignado && (
          <Button
            variant="ghost"
            fullWidth
            disabled={guardando}
            onClick={() => asignar(null)}
            leftIcon={<UserX size={18} />}
          >
            Dejar sin mozo
          </Button>
        )}

        <Button variant="ghost" fullWidth disabled={guardando} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
};

export default AsignarMozoModal;
