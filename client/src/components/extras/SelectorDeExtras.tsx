import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
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

/**
 * Los grupos de extras de un producto, como se eligen en el pedido web y en la
 * caja. Arrancan cerrados: se abre el que se toca, y cerrado muestra lo que ya
 * se eligió para no tener que abrirlo a revisar.
 */
const SelectorDeExtras: React.FC<Props> = ({ grupos, elegidas, onChange }) => {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const alternarGrupo = (id: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  return (
    <div className="space-y-3">
      {grupos.map((g) => {
        const abierto = abiertos.has(g.id);
        const marcadas = g.opciones.filter((o) => elegidas[g.id]?.has(o.id));
        const regla = `${g.minimo > 0 ? 'Obligatorio' : 'Opcional'}${g.maximo ? ` · hasta ${g.maximo}` : ''}`;

        return (
          <div
            key={g.id}
            className={`rounded-2xl border transition-colors ${
              marcadas.length > 0 ? 'border-primary/40' : 'border-border-subtle'
            } bg-surface-base/60`}
          >
            <button
              type="button"
              onClick={() => alternarGrupo(g.id)}
              aria-expanded={abierto}
              className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
              <span className="min-w-0">
                <span className="block font-black text-sm uppercase tracking-tight truncate">{g.nombre}</span>
                <span
                  className={`block text-[11px] font-bold mt-0.5 truncate ${
                    marcadas.length > 0 ? 'text-primary' : g.minimo > 0 ? 'text-warning' : 'text-text-muted'
                  }`}
                >
                  {marcadas.length > 0 ? marcadas.map((o) => o.nombre).join(', ') : regla}
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-text-muted transition-transform ${abierto ? 'rotate-180' : ''}`}
              />
            </button>

            {abierto && (
              <div className="space-y-2 px-3 pb-3">
                {marcadas.length > 0 && (
                  <p className="px-1 text-[10px] font-bold text-text-muted">{regla}</p>
                )}
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
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SelectorDeExtras;
