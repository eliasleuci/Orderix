/**
 * Horario de atención de los pedidos web.
 *
 * Se guarda en web_settings.schedule como { "0": [{ desde, hasta }], ... } con
 * la clave del día como en Date.getDay() (0 = domingo). Un turno cuyo "hasta"
 * no es mayor que el "desde" termina al día siguiente (20:00 a 01:00).
 */

export interface Turno {
  desde: string;
  hasta: string;
}
export type Horario = Record<string, Turno[]>;

// Los locales son de Argentina; el servidor corre en UTC.
const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const aMinutos = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Turnos válidos de un día, en minutos. Lo que venga mal armado se ignora. */
const turnosDelDia = (horario: Horario, dia: number) =>
  (Array.isArray(horario[String(dia)]) ? horario[String(dia)]! : [])
    .map((t) => ({ desde: aMinutos(t?.desde), hasta: aMinutos(t?.hasta), texto: t?.desde }))
    .filter((t): t is { desde: number; hasta: number; texto: string } => t.desde !== null && t.hasta !== null && t.desde !== t.hasta);

const ahoraLocal = (fecha: Date) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(valor('weekday'));
  return { dia, minutos: Number(valor('hour')) * 60 + Number(valor('minute')) };
};

export function estaAbierto(horario: Horario, fecha = new Date()): boolean {
  const { dia, minutos } = ahoraLocal(fecha);
  const ayer = (dia + 6) % 7;

  const hoy = turnosDelDia(horario, dia).some((t) =>
    t.hasta > t.desde ? minutos >= t.desde && minutos < t.hasta : minutos >= t.desde
  );
  // El turno de anoche que cruza la medianoche sigue abierto hasta su "hasta".
  const deAnoche = turnosDelDia(horario, ayer).some((t) => t.hasta < t.desde && minutos < t.hasta);
  return hoy || deAnoche;
}

/** "hoy a las 19:30", "mañana a las 12:00", "el viernes a las 20:00" o null si nunca abre. */
export function proximaApertura(horario: Horario, fecha = new Date()): string | null {
  const { dia, minutos } = ahoraLocal(fecha);
  for (let offset = 0; offset < 8; offset++) {
    const d = (dia + offset) % 7;
    const proximos = turnosDelDia(horario, d)
      .filter((t) => offset > 0 || t.desde > minutos)
      .sort((a, b) => a.desde - b.desde);
    const turno = proximos[0];
    if (!turno) continue;
    const cuando = offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : `el ${DIAS[d]}`;
    return `${cuando} a las ${turno.texto}`;
  }
  return null;
}
