import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  titulo: string;
  detalle?: string;
  children: React.ReactElement;
}

const MARGEN = 12;
const DEMORA_HOVER_MS = 150;
const DURACION_TOQUE_MS = 2200;

/**
 * Cartelito que explica un botón. Con mouse aparece al pasar por encima; en el
 * celular no existe el "pasar por encima", así que aparece un rato después de
 * tocar, mostrando el estado en el que quedó.
 */
export const Tooltip: React.FC<TooltipProps> = ({ titulo, detalle, children }) => {
  const anclaRef = useRef<HTMLSpanElement>(null);
  const globoRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; abajo: boolean } | null>(null);

  const limpiar = () => window.clearTimeout(timer.current);
  const mostrar = (ms = 0) => {
    limpiar();
    timer.current = window.setTimeout(() => setVisible(true), ms);
  };
  const ocultar = useCallback(() => {
    limpiar();
    setVisible(false);
    setPos(null);
  }, []);

  useEffect(() => limpiar, []);

  // El globo se dibuja fuera del modal (que tiene scroll y lo cortaría), con
  // posición fija calculada a partir del botón.
  useLayoutEffect(() => {
    if (!visible || !anclaRef.current || !globoRef.current) return;
    const a = anclaRef.current.getBoundingClientRect();
    const g = globoRef.current.getBoundingClientRect();
    const abajo = a.top - g.height - 8 < MARGEN;
    const top = abajo ? a.bottom + 8 : a.top - g.height - 8;
    const centro = a.left + a.width / 2 - g.width / 2;
    const left = Math.min(Math.max(centro, MARGEN), window.innerWidth - g.width - MARGEN);
    setPos({ top, left, abajo });
  }, [visible, titulo, detalle]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('scroll', ocultar, true);
    return () => window.removeEventListener('scroll', ocultar, true);
  }, [visible, ocultar]);

  return (
    <>
      <span
        ref={anclaRef}
        className="inline-flex shrink-0"
        onPointerEnter={(e) => e.pointerType === 'mouse' && mostrar(DEMORA_HOVER_MS)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && ocultar()}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse') return;
          limpiar();
          setVisible(true);
          timer.current = window.setTimeout(ocultar, DURACION_TOQUE_MS);
        }}
        onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && mostrar()}
        onBlur={ocultar}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={globoRef}
            role="tooltip"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="fixed z-[110] max-w-[240px] pointer-events-none rounded-xl border border-white/10 bg-surface-elevated px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          >
            <p className="text-xs font-black text-text-primary leading-snug">{titulo}</p>
            {detalle && <p className="text-[11px] text-text-secondary leading-snug mt-0.5">{detalle}</p>}
          </div>,
          document.body
        )}
    </>
  );
};
