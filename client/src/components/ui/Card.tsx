import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'solid' | 'glass';
  title?: string;
  actions?: React.ReactNode;
  padding?: 'normal' | 'large' | 'none';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'solid', title, actions, padding = 'large', children, ...props }, ref) => {
    
    const variantStyles = {
      solid: 'bg-surface-elevated border-border-subtle',
      // Sin backdrop-blur a propósito. Detrás de estas tarjetas hay un color
      // plano (--color-surface-base), así que desenfocarlo no cambia un pixel,
      // pero obliga al navegador a recomponer una capa de desenfoque por
      // tarjeta en cada frame. Con una grilla de productos son decenas de
      // capas, y era lo que trababa las animaciones en toda la app (medido:
      // 45fps con blur contra 60fps sin blur al abrir un modal sobre la
      // grilla). El fondo translúcido se mantiene: la apariencia no cambia.
      glass: 'bg-surface-glass border-border-subtle',
    };

    const paddingStyles = {
      normal: 'p-4',
      large: 'p-6',
      none: 'p-0',
    };

    return (
      // Sin animación de entrada: una pantalla como Catálogo o Venta monta
      // decenas de Cards juntas, y animarlas todas era lo que hacía que abrir
      // cualquier cosa se sintiera lento. Aparecen directamente.
      <motion.div
        ref={ref}
        initial={false}
        className={cn(
          'rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col transition-colors duration-300',
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {title || actions ? (
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-border-subtle">
            {title && (
              <h3 className="text-xl font-black uppercase tracking-tight text-text-primary">
                {title}
              </h3>
            )}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        ) : null}
        <div>
          {children as React.ReactNode}
        </div>
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
