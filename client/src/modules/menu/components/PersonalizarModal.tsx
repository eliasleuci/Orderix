import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ProductoVidriera } from '../../../services/webshopService';
import { ExtraElegido } from '../../../store/webCartStore';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import SelectorDeExtras, {
  Elegidas,
  faltaElegir as buscarFaltante,
  opcionesElegidas,
} from '../../../components/extras/SelectorDeExtras';

interface Props {
  producto: ProductoVidriera | null;
  onCerrar: () => void;
  onAgregar: (extras: ExtraElegido[], notas: string) => void;
}

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Selección de extras antes de agregar al carrito. Sólo se abre si el
 * producto tiene grupos cargados; el resto sigue agregándose directo.
 */
const PersonalizarModal: React.FC<Props> = ({ producto, onCerrar, onAgregar }) => {
  const [elegidas, setElegidas] = useState<Elegidas>({});
  const [notas, setNotas] = useState('');

  // Mientras el modal se está yendo, `producto` ya es null pero la animación de
  // salida sigue corriendo: sin esto la tarjeta se vaciaba de golpe y recién
  // después se desvanecía, que se ve como un parpadeo.
  const [ultimo, setUltimo] = useState<ProductoVidriera | null>(null);
  useEffect(() => {
    if (producto) setUltimo(producto);
  }, [producto]);

  const visible = producto ?? ultimo;
  const grupos = visible?.grupos ?? [];

  const extraTotal = useMemo(
    () => opcionesElegidas(grupos, elegidas).reduce((suma, o) => suma + o.precio, 0),
    [elegidas, grupos]
  );

  const faltaElegir = buscarFaltante(grupos, elegidas);

  const confirmar = () => {
    if (faltaElegir) return;

    const extras: ExtraElegido[] = opcionesElegidas(grupos, elegidas).map((o) => ({
      optionId: o.id,
      nombre: o.nombre,
      precio: o.precio,
    }));
    onAgregar(extras, notas);
    setElegidas({});
    setNotas('');
  };

  return (
    <Modal isOpen={Boolean(producto)} onClose={onCerrar} title={visible?.nombre ?? ''} maxWidth="sm">
      {visible && (
        <div className="space-y-5">
          {visible.descripcion && (
            <p className="text-text-secondary text-sm leading-relaxed">{visible.descripcion}</p>
          )}

          <SelectorDeExtras grupos={grupos} elegidas={elegidas} onChange={setElegidas} />

          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Alguna aclaración (opcional)"
            maxLength={200}
            className="w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-sm focus:outline-none focus:border-primary"
          />

          {/* Pegado al fondo del modal. Con una lista larga de opciones el
              botón quedaba abajo del pliegue, y como el modal esconde la barra
              de scroll no había ninguna señal de que hubiera que bajar: el
              cliente veía la lista y concluía que no se podía agregar nada. */}
          <div className="sticky bottom-0 bg-surface-elevated pt-3 pb-1 -mb-1">
            <Button
              fullWidth
              disabled={Boolean(faltaElegir)}
              onClick={confirmar}
              leftIcon={<Plus size={18} />}
            >
              {faltaElegir ? `Elegí ${faltaElegir.nombre.toLowerCase()}` : `Agregar — ${plata(visible.precio + extraTotal)}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default PersonalizarModal;
