import React from 'react';
import { Utensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';

interface ProductCardProps {
  product: any;
  onAdd: (product: any) => void;
  /** Si el producto tiene extras: tocar la tarjeta los abre; el + agrega simple. */
  onPersonalizar?: (product: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, onAdd, onPersonalizar }) => {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const tocarTarjeta = () => {
    if (isOutOfStock) return;
    if (onPersonalizar) onPersonalizar(product);
    else onAdd(product);
  };

  // div y no button: adentro va el botón +, y un botón no puede contener otro.
  return (
    <motion.div
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      whileTap={isOutOfStock ? undefined : { scale: 0.96 }}
      onClick={tocarTarjeta}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tocarTarjeta();
        }
      }}
      className={cn(
        "group relative flex text-left transition-all cursor-pointer",
        isOutOfStock && "opacity-50 pointer-events-none grayscale"
      )}
    >
      <Card
        variant="glass"
        padding="none"
        className={cn(
          "w-full border-border-subtle shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all",
          "bg-surface-elevated/80"
        )}
      >
        {/* IMAGE / ICON */}
        <div className="aspect-square bg-surface-base rounded-2xl mb-3 flex items-center justify-center overflow-hidden border-b border-border-subtle relative">
          {product.image_url ? (
            <img
              src={product.thumbnail_url || product.image_url}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
            />
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
        <div className="p-4">
          <h3 className="font-black text-lg text-text-primary uppercase tracking-tight leading-none mb-1 line-clamp-1">
            {product.name}
          </h3>
          <p className="text-text-muted text-[10px] uppercase font-bold tracking-widest line-clamp-1 mb-3">
            {onPersonalizar ? <span className="text-primary">Con extras</span> : product.category_name || "Producto"}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-primary tracking-tighter">
              ${Number(product.price)}
            </span>
            <button
              type="button"
              aria-label={onPersonalizar ? `Agregar ${product.name} simple` : `Agregar ${product.name}`}
              title={onPersonalizar ? 'Agregar simple, sin extras' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (!isOutOfStock) onAdd(product);
              }}
              className="w-10 h-10 rounded-xl bg-primary text-surface-base flex items-center justify-center font-black transition-transform hover:rotate-90 active:scale-90"
            >
              +
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
