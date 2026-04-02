import React from 'react';
import { Utensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { ANIMATIONS } from '../../../lib/motion';

interface ProductCardProps {
  product: any;
  onAdd: (product: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, onAdd }) => {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <motion.button
      whileTap={isOutOfStock ? undefined : { scale: 0.96 }}
      onClick={() => !isOutOfStock && onAdd(product)}
      className={cn(
        "group relative flex text-left transition-all",
        isOutOfStock && "opacity-50 pointer-events-none grayscale"
      )}
    >
      <Card
        variant="glass"
        padding="normal"
        className={cn(
          "w-full border-border-subtle shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all",
          "bg-surface-elevated/80 backdrop-blur-md"
        )}
      >
        {/* IMAGE / ICON */}
        <div className="aspect-square bg-surface-base rounded-2xl mb-4 flex items-center justify-center overflow-hidden border border-border-subtle relative">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
          ) : (
            <Utensils className="w-10 h-10 text-text-muted" />
          )}

          {/* STOCK BADGE */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {isOutOfStock ? (
              <Badge variant="danger" size="md">AGOTADO</Badge>
            ) : isLowStock ? (
              <Badge variant="warning" size="md">SÓLO {product.stock}</Badge>
            ) : (
              <Badge variant="success" size="md">DISPONIBLE</Badge>
            )}
          </div>
        </div>

        {/* INFO */}
        <div className="flex flex-col">
          <h3 className="font-black text-lg text-text-primary uppercase tracking-tight leading-none mb-2 line-clamp-1">
            {product.name}
          </h3>
          <p className="text-text-muted text-[10px] uppercase font-bold tracking-widest line-clamp-1 mb-4">
            {product.category_name || "Producto"}
          </p>

          <div className="mt-auto flex items-center justify-between">
            <span className="text-2xl font-black text-primary tracking-tighter">
              ${Number(product.price)}
            </span>
            <div className="w-10 h-10 rounded-xl bg-primary text-surface-base flex items-center justify-center font-black transition-transform group-hover:rotate-90">
              +
            </div>
          </div>
        </div>
      </Card>
    </motion.button>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
