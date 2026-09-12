import React from 'react';
import { Receipt, Clock } from 'lucide-react';
import { Table, ConsumoMesa } from '../../../services/tableService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
  consumo: ConsumoMesa | null;
  /** Nombre del mozo a cargo, si hay alguno asignado. */
  mozo?: string;
}

const plata = (n: number) => `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

/**
 * Sólo para mirar: ni cobra ni libera la mesa. Antes, para ver qué había
 * consumido una mesa había que entrar a Cobrar, que es la última pantalla que
 * uno quiere abrir en el medio del servicio sólo para chequear algo.
 */
const ConsumoModal: React.FC<Props> = ({ isOpen, onClose, table, consumo, mozo }) => {
  const pedidos = consumo?.pedidos ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={table ? `Consumo de ${table.label || `Mesa ${table.number}`}` : 'Consumo'}
      maxWidth="md"
    >
      <div className="space-y-5">
        {(table?.customer_name || mozo) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-text-secondary">
            {table?.customer_name && <span>👤 {table.customer_name}</span>}
            {mozo && <span className="text-text-muted">Atiende {mozo}</span>}
          </div>
        )}

        {pedidos.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">
            Todavía no se cargó ningún pedido en esta mesa.
          </p>
        ) : (
          <>
            <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
              {pedidos.map((o: any, i: number) => (
                <div key={o.id} className="rounded-2xl border border-white/5 bg-surface-base p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <Receipt size={12} /> Pedido {i + 1}
                      <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                        <Clock size={11} /> {hora(o.created_at)}
                      </span>
                    </span>
                    <span className="text-sm font-black">{plata(o.total)}</span>
                  </div>

                  <ul className="space-y-1.5">
                    {(o.order_items ?? []).map((it: any) => (
                      <li key={it.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="font-bold text-text-muted mr-1.5">{it.quantity}×</span>
                          <span className="text-text-primary">{it.products?.name ?? 'Producto'}</span>
                          {it.notes && (
                            <span className="block text-[11px] text-text-muted italic mt-0.5">{it.notes}</span>
                          )}
                        </span>
                        <span className="text-text-secondary font-bold shrink-0 tabular-nums">
                          {plata(Number(it.unit_price ?? 0) * Number(it.quantity ?? 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                Lleva consumido
              </span>
              <span className="text-2xl font-black text-primary tracking-tighter tabular-nums">
                {plata(consumo?.total ?? 0)}
              </span>
            </div>
          </>
        )}

        <Button variant="ghost" fullWidth onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
};

export default ConsumoModal;
