import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col items-center text-center space-y-6 pt-2">
        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 border-dashed ${
          variant === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 
          variant === 'warning' ? 'bg-warning/10 border-warning/30 text-warning' : 
          'bg-primary/10 border-primary/30 text-primary'
        }`}>
          {variant === 'danger' ? <Trash2 size={40} /> : <AlertCircle size={40} />}
        </div>

        <div className="space-y-2">
          <p className="text-text-primary text-base font-bold leading-relaxed px-4">
            {message}
          </p>
          <p className="text-text-muted text-xs font-black uppercase tracking-widest opacity-60">
            Esta acción no se puede deshacer
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="border border-white/5 hover:bg-white/5"
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
