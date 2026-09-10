import React from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

/** Campo de formulario del panel. Mantiene el look oscuro propio del módulo. */
export const Field: React.FC<FieldProps> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[10px] font-black uppercase tracking-widest text-white/50 mb-2">
      {label}
    </span>
    {children}
    {hint && <span className="block text-xs text-white/40 mt-1.5">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white ' +
  'placeholder:text-white/25 outline-none focus:border-indigo-500/60 transition-colors';

/** Convierte un nombre en un identificador de URL válido. */
export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export default Field;
