import React from 'react';
import { Check } from 'lucide-react';
import type { GrupoExtras } from '../../services/webshopService';

/** Opciones marcadas, por id de grupo. */
export type Elegidas = Record<string, Set<string>>;

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

export function alternarOpcion(prev: Elegidas, grupo: GrupoExtras, opcionId: string): Elegidas {
  const actual = new Set(prev[grupo.id] ?? []);

  if (grupo.maximo === 1) {
    // Como un radio: marcar otra reemplaza a la anterior, nunca se acumulan.
    const yaEstaba = actual.has(opcionId);
    actual.clear();
    if (!yaEstaba) actual.add(opcionId);
  } else if (actual.has(opcionId)) {
    actual.delete(opcionId);
  } else if (grupo.maximo == null || actual.size < grupo.maximo) {
    actual.add(opcionId);
  }

  return { ...prev, [grupo.id]: actual };
}

export const opcionesElegidas = (grupos: GrupoExtras[], elegidas: Elegidas) =>
  grupos.flatMap((g) => g.opciones.filter((o) => elegidas[g.id]?.has(o.id)));

export const faltaElegir = (grupos: GrupoExtras[], elegidas: Elegidas) =>
  grupos.find((g) => (elegidas[g.id]?.size ?? 0) < g.minimo);

interface Props {
  grupos: GrupoExtras[];
  elegidas: Elegidas;
  onChange: (elegidas: Elegidas) => void;
}

/** Los grupos de extras de un producto, como se eligen en el pedido web y en la caja. */
const SelectorDeExtras: React.FC<Props> = ({ grupos, elegidas, onChange }) => (
  <>
    {grupos.map((g) => (
      <div key={g.id}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">{g.nombre}</h4>
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
                type="button"
                onClick={() => onChange(alternarOpcion(elegidas, g, o.id))}
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
                {o.precio > 0 && <span className="text-xs font-black text-primary shrink-0">+{plata(o.precio)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </>
);

export default SelectorDeExtras;
