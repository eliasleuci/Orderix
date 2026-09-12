import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { TRANSITIONS, ANIMATIONS } from '../lib/motion';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose, duration = 5000 }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  // Al body por el mismo motivo que el Modal: colgado del árbol de la pantalla,
  // el z-index queda encerrado en el contexto de apilamiento de turno.
  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={TRANSITIONS.snappy}
          className={cn(
            'fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-8 py-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border',
            type === 'success' 
              ? 'bg-emerald-500 text-white border-emerald-400' 
              : 'bg-rose-500 text-white border-rose-400'
          )}
        >
          {type === 'success' ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
          <div className="flex flex-col">
            <span className="font-black uppercase tracking-widest text-[10px] opacity-80 leading-none mb-1">
              {type === 'success' ? 'Éxito' : 'Error'}
            </span>
            <span className="font-bold text-lg leading-tight">{message}</span>
          </div>
          <button 
            onClick={onClose} 
            className="ml-6 p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Toast;
