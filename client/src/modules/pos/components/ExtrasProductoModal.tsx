import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { GrupoExtras } from '../../../services/webshopService';
import type { CartModifier } from '../../../store/cartStore';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import SelectorDeExtras, {
  Elegidas,
  faltaElegir as buscarFaltante,
  opcionesElegidas,
} from '../../../components/extras/SelectorDeExtras';

export interface ProductoConExtras {
  id: string;
  name: string;
  price: number;
  grupos: GrupoExtras[];
}

interface Props {
  producto: ProductoConExtras | null;
  onCerrar: () => void;
  onAgregar: (modifiers: CartModifier[], notas: string) => void;
}

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Los mismos extras que ve el cliente en el pedido web, al tocar un producto
 * en la caja. Todo es opcional salvo que el grupo diga lo contrario: sin
 * marcar nada entra el producto simple.
 */
const ExtrasProductoModal: React.FC<Props> = ({ producto, onCerrar, onAgregar }) => {
  const [elegidas, setElegidas] = useState<Elegidas>({});
  const [notas, setNotas] = useState('');

  // Durante la animación de salida `producto` ya es null: se sigue mostrando el
  // último para que el contenido no desaparezca antes que el modal.
  const [ultimo, setUltimo] = useState<ProductoConExtras | null>(null);
  useEffect(() => {
    if (producto) {
      setUltimo(producto);
      setElegidas({});
      setNotas('');
    }
  }, [producto]);

  const visible = producto ?? ultimo;
  const grupos = visible?.grupos ?? [];
  const marcadas = useMemo(() => opcionesElegidas(grupos, elegidas), [grupos, elegidas]);
  const extraTotal = marcadas.reduce((suma, o) => suma + o.precio, 0);
  const faltaElegir = buscarFaltante(grupos, elegidas);

  const agregar = () => {
    if (faltaElegir) return;
    onAgregar(
      marcadas.map((o) => ({ label: o.nombre, price: o.precio })),
      notas.trim()
    );
  };

  return (
    <Modal isOpen={Boolean(producto)} onClose={onCerrar} title={visible?.name ?? ''} maxWidth="sm">
      {visible && (
        <div className="space-y-5">
          <SelectorDeExtras grupos={grupos} elegidas={elegidas} onChange={setElegidas} />

          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder="Nota para cocina (opcional)"
            maxLength={200}
            className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-sm focus:outline-none focus:border-primary"
          />

          <div className="sticky bottom-0 bg-surface-elevated pt-3 pb-1 -mb-1">
            <Button fullWidth disabled={Boolean(faltaElegir)} onClick={agregar} leftIcon={<Plus size={18} />}>
              {faltaElegir
                ? `Elegí ${faltaElegir.nombre.toLowerCase()}`
                : marcadas.length === 0
                  ? `Agregar simple — ${plata(visible.price)}`
                  : `Agregar — ${plata(visible.price + extraTotal)}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ExtrasProductoModal;
