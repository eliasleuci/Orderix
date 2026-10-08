import React from 'react';
import { Plus, X, Copy } from 'lucide-react';
import type { HorarioWeb, TurnoWeb } from '../../../services/webshopService';

// Lunes primero, como se piensa la semana en un local; la clave sigue siendo la
// de JavaScript (0 = domingo), que es la que entiende el servidor.
const DIAS: Array<{ clave: string; nombre: string }> = [
  { clave: '1', nombre: 'Lunes' },
  { clave: '2', nombre: 'Martes' },
  { clave: '3', nombre: 'Miércoles' },
  { clave: '4', nombre: 'Jueves' },
  { clave: '5', nombre: 'Viernes' },
  { clave: '6', nombre: 'Sábado' },
  { clave: '0', nombre: 'Domingo' },
];

const TURNO_NUEVO: TurnoWeb = { desde: '20:00', hasta: '00:00' };
const MAX_TURNOS = 2;

export const horarioPorDefecto = (): HorarioWeb =>
  Object.fromEntries(DIAS.map((d) => [d.clave, [{ ...TURNO_NUEVO }]]));

/** Mensaje de error para mostrar al guardar, o null si está bien. */
export function validarHorario(horario: HorarioWeb): string | null {
  const turnos = Object.values(horario).flat();
  if (turnos.length === 0) return 'Marcá al menos un día abierto, o apagá el horario';
  for (const t of turnos) {
    if (!t.desde || !t.hasta) return 'Completá el horario de todos los turnos';
    if (t.desde === t.hasta) return 'Un turno no puede empezar y terminar a la misma hora';
  }
  return null;
}

const inputHora =
  'bg-surface-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [color-scheme:dark]';

interface Props {
  horario: HorarioWeb;
  onChange: (horario: HorarioWeb) => void;
}

const HorarioWebEditor: React.FC<Props> = ({ horario, onChange }) => {
  const turnosDe = (clave: string) => horario[clave] ?? [];
  const setDia = (clave: string, turnos: TurnoWeb[]) => onChange({ ...horario, [clave]: turnos });

  const editarTurno = (clave: string, i: number, campo: keyof TurnoWeb, valor: string) =>
    setDia(clave, turnosDe(clave).map((t, j) => (j === i ? { ...t, [campo]: valor } : t)));

  const primerDiaAbierto = DIAS.find((d) => turnosDe(d.clave).length > 0);
  const copiarATodos = () => {
    if (!primerDiaAbierto) return;
    const base = turnosDe(primerDiaAbierto.clave);
    onChange(Object.fromEntries(DIAS.map((d) => [d.clave, base.map((t) => ({ ...t }))])));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {DIAS.map(({ clave, nombre }) => {
          const turnos = turnosDe(clave);
          const abierto = turnos.length > 0;
          return (
            <div
              key={clave}
              className={`rounded-2xl border p-3 ${abierto ? 'border-white/10 bg-surface-base' : 'border-white/5 bg-surface-base/50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`font-black text-sm ${abierto ? '' : 'text-text-muted'}`}>{nombre}</span>
                <button
                  type="button"
                  onClick={() => setDia(clave, abierto ? [] : [{ ...TURNO_NUEVO }])}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                    abierto
                      ? 'text-success border-success/30 bg-success/10'
                      : 'text-text-muted border-white/10 hover:border-primary/40'
                  }`}
                >
                  {abierto ? 'Abierto' : 'Cerrado'}
                </button>
              </div>

              {abierto && (
                <div className="mt-3 space-y-2">
                  {turnos.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="time"
                        value={t.desde}
                        onChange={(e) => editarTurno(clave, i, 'desde', e.target.value)}
                        aria-label={`${nombre}, desde`}
                        className={inputHora}
                      />
                      <span className="text-xs text-text-muted">a</span>
                      <input
                        type="time"
                        value={t.hasta}
                        onChange={(e) => editarTurno(clave, i, 'hasta', e.target.value)}
                        aria-label={`${nombre}, hasta`}
                        className={inputHora}
                      />
                      {t.hasta && t.desde && t.hasta !== '00:00' && t.hasta < t.desde && (
                        <span className="text-[10px] text-text-muted">(cierra al día siguiente)</span>
                      )}
                      {turnos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDia(clave, turnos.filter((_, j) => j !== i))}
                          aria-label="Quitar turno"
                          className="p-1.5 text-text-muted hover:text-danger transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {turnos.length < MAX_TURNOS && (
                    <button
                      type="button"
                      onClick={() => setDia(clave, [...turnos, { desde: '12:00', hasta: '15:00' }])}
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                    >
                      <Plus size={12} /> Otro turno
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {primerDiaAbierto && (
        <button
          type="button"
          onClick={copiarATodos}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <Copy size={13} /> Usar el horario del {primerDiaAbierto.nombre.toLowerCase()} para todos los días
        </button>
      )}
      <p className="text-[10px] text-text-muted">
        Si cerrás después de medianoche, ponelo tal cual (por ejemplo 20:00 a 01:00): se toma hasta la 1 del
        día siguiente. Es la hora de Argentina.
      </p>
    </div>
  );
};

export default HorarioWebEditor;
