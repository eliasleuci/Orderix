import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import Card from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md', className }) => {
  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  // Va montado en el body y no donde se lo invoca: casi todas las pantallas
  // envuelven su contenido en algo con `relative z-*`, que abre un contexto de
  // apilamiento y deja encerrado el z-index del modal. Así el reporte del
  // Financiero quedaba tapado por las tarjetas de abajo.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* BACKDROP */}
          <motion.div
            initial={false}
            onClick={onClose}
            // Sin blur: animar un backdrop-filter de pantalla completa sobre
            // paneles "glass" (con su propio blur) es de lo más caro que puede
            // pintar un navegador por frame, y es lo que hacía que abrir
            // cualquier modal se sintiera tildado. El oscurecido solo alcanza
            // para marcar que hay un modal encima.
            className="absolute inset-0 bg-slate-950/80"
          />

          {/* CONTENT */}
          <motion.div
            initial={false}
            className={cn("w-full relative", maxWidthClasses[maxWidth], className)}
          >
            <Card variant="solid" padding="large" className="bg-surface-elevated border-white/5 shadow-2xl w-full">
              <header className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-text-primary leading-none">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 text-text-muted hover:text-primary transition-colors border border-white/5"
                >
                  <X size={20} />
                </button>
              </header>

              <div className="relative max-h-[65vh] overflow-y-auto scrollbar-none">
                {children}
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
