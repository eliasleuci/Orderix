import React from 'react';
import { Trash2, Plus, Minus, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { TRANSITIONS, ANIMATIONS } from '../../../lib/motion';

interface CartItemProps {
  item: any;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
}

const CartItem: React.FC<CartItemProps> = React.memo(({ item, onUpdateQuantity, onRemove, onEdit }) => {
  return (
    <motion.div
      layout
      {...ANIMATIONS.fadeInUp}
      exit={{ opacity: 0, x: -20 }}
      className="bg-surface-elevated rounded-2xl p-4 flex items-center justify-between border border-border-subtle shadow-inner transition-colors duration-300"
    >
      <div className="flex-1 min-w-0 mr-3">
        <h4 className="font-black text-[13px] text-text-primary uppercase tracking-tight truncate">
          {item.name}
        </h4>
        
        {/* MODIFICADORES & NOTAS */}
        {(item.modifiers?.length > 0 || item.notes) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.modifiers?.map((mod: any) => (
              <span key={mod.label} className={`text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded ${mod.label.startsWith('+') ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger'}`}>
                {mod.label} {mod.price > 0 && `(+$${mod.price})`}
              </span>
            ))}
            {item.notes && (
              <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[100px]">
                Nota: {item.notes}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-primary font-black text-base tracking-tighter">
            ${item.price}
          </span>
          {item.quantity > 1 && (
            <span className="text-text-muted text-[9px] font-bold uppercase tracking-widest mt-1">
              x{item.quantity}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-surface-base rounded-xl p-1 border border-border-subtle shrink-0 transition-colors duration-300">
        {onEdit && (
          <button
            onClick={() => onEdit(item.cartItemId)}
            className="w-8 h-8 flex flex-col items-center justify-center text-text-muted hover:text-text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-95"
            title="Personalizar"
          >
            <Settings2 size={14} />
          </button>
        )}
        <div className="w-px h-5 bg-border-subtle mx-0.5" />
        
        <button
          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-all active:scale-95"
          disabled={item.quantity <= 1}
        >
          <Minus size={14} strokeWidth={3} />
        </button>
        
        <span className="w-4 text-center font-black text-text-primary text-sm">
          {item.quantity}
        </span>

        <button
          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
          className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-95"
        >
          <Plus size={14} strokeWidth={3} />
        </button>

        <div className="w-px h-5 bg-border-subtle mx-0.5" />

        <button
          onClick={() => onRemove(item.cartItemId)}
          className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all active:scale-95"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
});

CartItem.displayName = 'CartItem';

export default CartItem;
