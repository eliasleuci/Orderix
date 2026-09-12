import React, { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { ProductoVidriera } from '../../../services/webshopService';
import { ExtraElegido } from '../../../store/webCartStore';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface Props {
  producto: ProductoVidriera | null;
  onCerrar: () => void;
  onAgregar: (extras: ExtraElegido[], notas: string) => void;
}

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Selección de extras antes de agregar al carrito. Sólo se abre si el
 * producto tiene grupos cargados; el resto sigue agregándose directo.
 */
const PersonalizarModal: React.FC<Props> = ({ producto, onCerrar, onAgregar }) => {
  const [elegidas, setElegidas] = useState<Record<string, Set<string>>>({});
  const [notas, setNotas] = useState('');

  const grupos = producto?.grupos ?? [];

  const alternar = (grupoId: string, opcionId: string, maximo: number | null) => {
    setElegidas((prev) => {
      const actual = new Set(prev[grupoId] ?? []);

      if (maximo === 1) {
        // Como un radio: marcar otra reemplaza a la anterior, nunca se acumulan.
        const yaEstaba = actual.has(opcionId);
        actual.clear();
        if (!yaEstaba) actual.add(opcionId);
      } else {
        if (actual.has(opcionId)) actual.delete(opcionId);
        else if (maximo == null || actual.size < maximo) actual.add(opcionId);
      }

      return { ...prev, [grupoId]: actual };
    });
  };

  const extraTotal = useMemo(() => {
    let suma = 0;
    for (const g of grupos) {
      for (const o of g.opciones) {
        if (elegidas[g.id]?.has(o.id)) suma += o.precio;
      }
    }
    return suma;
  }, [elegidas, grupos]);

  const faltaElegir = grupos.find((g) => (elegidas[g.id]?.size ?? 0) < g.minimo);

  const confirmar = () => {
    if (faltaElegir) return;

    const extras: ExtraElegido[] = [];
    for (const g of grupos) {
      for (const o of g.opciones) {
        if (elegidas[g.id]?.has(o.id)) extras.push({ optionId: o.id, nombre: o.nombre, precio: o.precio });
      }
    }
    onAgregar(extras, notas);
    setElegidas({});
    setNotas('');
  };

  return (
    <Modal isOpen={Boolean(producto)} onClose={onCerrar} title={producto?.nombre ?? ''} maxWidth="sm">
      {producto && (
        <div className="space-y-5">
          {producto.descripcion && (
            <p className="text-text-secondary text-sm leading-relaxed">{producto.descripcion}</p>
          )}

          {grupos.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                  {g.nombre}
                </h4>
                <span className="text-[10px] font-bold text-text-muted">
                  {g.minimo > 0 ? 'Obligatorio' : 'Opcional'}
                  {g.maximo ? ` · hasta ${g.maximo}` : ''}
                </span>
              </div>

              <div className="space-y-2">
                {g.opciones.map((o) => {
                  const marcada = elegidas[g.id]?.has(o.id) ?? false;
                  return (
                    <button
                      key={o.id}
                      onClick={() => alternar(g.id, o.id, g.maximo)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all ${
                        marcada ? 'border-primary bg-primary/10' : 'border-border-subtle bg-surface-base hover:border-primary/40'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5 font-bold text-sm">
                        <span
                          className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${
                            marcada ? 'bg-primary border-primary' : 'border-white/20'
                          }`}
                        >
                          {marcada && <Check size={13} className="text-white" />}
                        </span>
                        {o.nombre}
                      </span>
                      {o.precio > 0 && (
                        <span className="text-xs font-black text-primary shrink-0">+{plata(o.precio)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Alguna aclaración (opcional)"
            maxLength={200}
            className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-sm focus:outline-none focus:border-primary"
          />

          <Button
            fullWidth
            disabled={Boolean(faltaElegir)}
            onClick={confirmar}
            leftIcon={<Plus size={18} />}
          >
            {faltaElegir ? `Elegí ${faltaElegir.nombre.toLowerCase()}` : `Agregar — ${plata(producto.precio + extraTotal)}`}
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default PersonalizarModal;
