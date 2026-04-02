import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  errorMessage?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, errorMessage, icon, disabled, ...props }, ref) => {
    
    const inputStyles = cn(
      'w-full bg-surface-elevated border border-border-subtle rounded-2xl py-4 px-6 text-text-primary placeholder:text-text-muted transition-all duration-300',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary shadow-sm',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      errorMessage && 'border-danger focus-visible:ring-danger',
      icon && 'pl-14 transition-all',
      className
    );

    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-xs font-black text-text-muted uppercase tracking-widest pl-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none transition-colors group-focus-within:text-primary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={inputStyles}
            {...props}
          />
        </div>
        {errorMessage && (
          <p className="text-xs font-bold text-danger pl-2 animate-fadeIn">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
