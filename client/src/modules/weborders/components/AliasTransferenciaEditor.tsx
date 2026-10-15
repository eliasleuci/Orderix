import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AliasTransferencia } from '../../../services/webshopService';

interface Props {
  aliases: AliasTransferencia[];
  onChange: (aliases: AliasTransferencia[]) => void;
}

/**
 * Los alias o CBU del local. Uno solo está en uso: es el que ve el cliente al
 * elegir transferencia. El resto queda guardado para cambiar de cuenta con un
 * toque, sin volver a escribirla.
 */
const AliasTransferenciaEditor: React.FC<Props> = ({ aliases, onChange }) => {
  const [nuevo, setNuevo] = useState('');

  const agregar = () => {
    const alias = nuevo.trim();
    if (!alias) return;
    // El primero que se carga queda en uso; los siguientes, guardados.
    onChange([...aliases, { alias, activo: aliases.every((a) => !a.activo) }]);
    setNuevo('');
  };

  const usar = (i: number) => onChange(aliases.map((a, j) => ({ ...a, activo: j === i })));

  const editar = (i: number, alias: string) => onChange(aliases.map((a, j) => (j === i ? { ...a, alias } : a)));

  const borrar = (i: number) => {
    const quedan = aliases.filter((_, j) => j !== i);
    // Si se borra el que estaba en uso, pasa a usarse el primero que quede.
    if (aliases[i]?.activo && quedan.length > 0) quedan[0] = { ...quedan[0]!, activo: true };
    onChange(quedan);
  };

  return (
    <div className="space-y-2">
      {aliases.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-2xl border p-2 pl-3 ${
            a.activo ? 'border-primary bg-primary/10' : 'border-border-subtle bg-surface-base'
          }`}
        >
          <button
            type="button"
            onClick={() => usar(i)}
            aria-label={a.activo ? 'En uso' : 'Usar este alias'}
            className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
              a.activo ? 'border-primary' : 'border-white/30 hover:border-primary/60'
            }`}
          >
            {a.activo && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </button>
          <input
            value={a.alias}
            onChange={(e) => editar(i, e.target.value)}
            maxLength={120}
            className="flex-1 min-w-0 bg-transparent text-sm font-bold focus:outline-none"
          />
          {a.activo ? (
            <span className="text-[9px] font-black uppercase tracking-widest text-primary shrink-0 px-2">En uso</span>
          ) : (
            <button
              type="button"
              onClick={() => usar(i)}
              className="text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-primary shrink-0 px-2"
            >
              Usar
            </button>
          )}
          <button
            type="button"
            onClick={() => borrar(i)}
            aria-label="Borrar alias"
            className="p-1.5 text-text-muted hover:text-danger transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder={aliases.length === 0 ? 'Alias o CBU que se le muestra al cliente' : 'Otro alias o CBU'}
          maxLength={120}
          className="flex-1 min-w-0 bg-surface-base border border-border-subtle rounded-2xl h-11 px-4 text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={agregar}
          disabled={!nuevo.trim()}
          className="inline-flex items-center gap-1.5 px-4 h-11 rounded-2xl border border-primary/40 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/10 disabled:opacity-40 shrink-0"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
      {aliases.length > 1 && (
        <p className="text-[10px] text-text-muted">
          El cliente sólo ve el que está en uso. Tocá otro para cambiarlo y guardá.
        </p>
      )}
    </div>
  );
};

export default AliasTransferenciaEditor;
