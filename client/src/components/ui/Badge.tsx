import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TRANSITIONS } from '../../lib/motion';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md', className }) => {
  
  const variantStyles = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    danger: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    neutral: 'bg-slate-700/50 text-slate-100 border-white/10 shadow-sm',
    primary: 'bg-primary/20 text-primary border-primary/20',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[8px]',
    md: 'px-3 py-1 text-[10px]',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={TRANSITIONS.snappy}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-black uppercase tracking-widest border',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </motion.span>
  );
};

export default Badge;
