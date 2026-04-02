import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ANIMATIONS } from '../../lib/motion';

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
      glass: 'bg-surface-glass backdrop-blur-xl border-border-subtle glass',
    };

    const paddingStyles = {
      normal: 'p-4',
      large: 'p-6',
      none: 'p-0',
    };

    return (
      <motion.div
        ref={ref}
        initial={ANIMATIONS.scaleIn.initial}
        animate={ANIMATIONS.scaleIn.animate}
        transition={ANIMATIONS.scaleIn.transition}
        className={cn(
          'rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col transition-all duration-300',
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
        <div className="flex-1">
          {children as React.ReactNode}
        </div>
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
