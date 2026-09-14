import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Trash2, Image as ImageIcon } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { Product } from '../../../types/domain';

interface ProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

/**
 * Aislado de CatalogPage y memoizado a propósito: si el grid viviera en el
 * mismo componente que el modal de edición, abrir o cerrar el modal
 * re-renderizaría las decenas de tarjetas al pedo. Con esto, abrir el modal
 * no toca el grid.
 */
const ProductGrid: React.FC<ProductGridProps> = React.memo(({ products, onEdit, onDelete }) => {
  return (
    <AnimatePresence mode="popLayout">
      {products.map((p) => (
        <motion.div key={p.id}>
          <Card variant="glass" padding="normal" className={`relative flex flex-col border ${p.is_active ? 'border-primary/10 hover:border-primary/30' : 'border-danger/20 opacity-70'} transition-all duration-300 group shadow-sm hover:shadow-xl`}>

            <div className="aspect-[4/3] rounded-2xl bg-surface-base/50 mb-4 flex items-center justify-center overflow-hidden relative border border-border-subtle">
              {p.image_url ? (
                <img
                  src={p.thumbnail_url || p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <ImageIcon size={48} className="text-text-muted/20" />
              )}
              <div className="absolute top-4 left-4">
                <Badge variant={p.is_active ? "success" : "danger"}>
                  {p.is_active ? "Activo" : "Pausado"}
                </Badge>
              </div>
            </div>

            <div className="flex-1 min-h-[80px]">
              <h4 className="font-black text-xl tracking-tight uppercase leading-tight mb-2 text-text-primary">{p.name}</h4>
              <p className="text-text-muted text-xs line-clamp-2 font-medium">
                {p.description || "Sin descripción establecida."}
              </p>
            </div>

            <div className="flex items-end justify-between mt-6">
              <span className="text-2xl font-black text-primary tracking-tighter">${p.price}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                <button
                  onClick={() => onEdit(p)}
                  className="w-10 h-10 bg-primary/10 hover:bg-primary/20 rounded-xl flex items-center justify-center text-primary transition-colors"
                  title="Editar"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  onClick={() => onDelete(p.id)}
                  className="w-10 h-10 bg-danger/10 hover:bg-danger/20 rounded-xl flex items-center justify-center text-danger transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </AnimatePresence>
  );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;
