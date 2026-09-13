import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, EyeOff, Eye, Utensils, UtensilsCrossed } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { productService } from '../../../services/productService';
import { Category } from '../../../types/domain';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { comprimirImagen } from '../../../lib/imagenes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCambios: () => void;
  onAviso: (mensaje: string, tipo: 'success' | 'error') => void;
}

/**
 * Categorías con foto y orden, para que la vidriera del pedido web se vea como
 * la tienda que el dueño ya conoce: tarjetas grandes, no una lista de texto.
 */
const CategoriasModal: React.FC<Props> = ({ isOpen, onClose, onCambios, onAviso }) => {
  const { tenantId } = useAuthStore();

  const [categorias, setCategorias] = useState<Category[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [huboCambios, setHuboCambios] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data } = await productService.getCategories();
    setCategorias(data ?? []);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (isOpen) cargar();
  }, [isOpen, cargar]);

  const cerrar = () => {
    if (huboCambios) onCambios();
    setHuboCambios(false);
    onClose();
  };

  const agregar = async () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return onAviso('Poné un nombre para la categoría', 'error');

    const { error } = await productService.createCategory(nombre, tenantId || '');
    if (error) return onAviso(error, 'error');

    setNombreNueva('');
    setHuboCambios(true);
    cargar();
  };

  const subirFoto = async (cat: Category, file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      return onAviso('La imagen es demasiado grande (máximo 15MB)', 'error');
    }
    const dataUrl = await comprimirImagen(file);
    const { error } = await productService.updateCategory(cat.id, { image_url: dataUrl });
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  const renombrar = async (cat: Category, nombre: string) => {
    if (!nombre.trim() || nombre === cat.name) return;
    const { error } = await productService.updateCategory(cat.id, { name: nombre.trim().toUpperCase() });
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  const alternarPausa = async (cat: Category) => {
    const { error } = await productService.updateCategory(cat.id, { is_active: !cat.is_active });
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  const alternarVisibleEnCarta = async (cat: Category) => {
    const { error } = await productService.updateCategory(cat.id, { show_in_carta: !cat.show_in_carta });
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  const [borrando, setBorrando] = useState<Category | null>(null);
  const confirmarBorrado = async () => {
    if (!borrando) return;
    const { error } = await productService.deleteCategory(borrando.id);
    setBorrando(null);
    if (error) return onAviso(error, 'error');
    setHuboCambios(true);
    cargar();
  };

  /** Intercambia el orden con la vecina, para subir o bajar en la lista. */
  const mover = async (index: number, direccion: -1 | 1) => {
    const otra = categorias[index + direccion];
    const actual = categorias[index];
    if (!otra || !actual) return;

    const ordenActual = actual.display_order ?? 0;
    const ordenOtra = otra.display_order ?? 0;

    await Promise.all([
      productService.updateCategory(actual.id, { display_order: ordenOtra }),
      productService.updateCategory(otra.id, { display_order: ordenActual }),
    ]);
    setHuboCambios(true);
    cargar();
  };

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Categorías" maxWidth="md">
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">
          El orden de acá abajo es el mismo con el que se muestran en el pedido web.
          Pausada no se borra, sólo se oculta. El ícono de cubiertos controla si se
          muestra en la carta del salón (la de los QR de mesa); una categoría puede
          quedar sólo para pedidos online sin pausarla del todo.
        </p>

        <div className="flex gap-3">
          <Input
            placeholder="Nombre de la categoría"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
            className="flex-1"
          />
          <Button leftIcon={<Plus size={18} />} onClick={agregar}>
            Sumar
          </Button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categorias.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">Todavía no hay categorías.</p>
        ) : (
          <div className="space-y-3">
            {categorias.map((cat, i) => (
              <div
                key={cat.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  cat.is_active === false ? 'border-white/5 bg-surface-base opacity-50' : 'border-white/10 bg-surface-base'
                }`}
              >
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-text-muted"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => mover(i, 1)}
                    disabled={i === categorias.length - 1}
                    className="p-1 text-text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-text-muted"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <label className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0 cursor-pointer relative group">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-text-muted" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon size={16} className="text-white" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && subirFoto(cat, e.target.files[0])}
                  />
                </label>

                <input
                  defaultValue={cat.name}
                  onBlur={(e) => renombrar(cat, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent font-black tracking-tight text-sm focus:outline-none border-b border-transparent focus:border-primary/40 py-1"
                />

                <button
                  onClick={() => alternarVisibleEnCarta(cat)}
                  title={
                    cat.show_in_carta === false
                      ? 'No se muestra en la carta del salón (sí en pedidos online). Click para mostrarla.'
                      : 'Se muestra en la carta del salón. Click para ocultarla ahí (sigue en pedidos online).'
                  }
                  className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors shrink-0"
                >
                  {cat.show_in_carta === false ? <UtensilsCrossed size={16} /> : <Utensils size={16} />}
                </button>
                <button
                  onClick={() => alternarPausa(cat)}
                  title={cat.is_active === false ? 'Reactivar' : 'Pausar'}
                  className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors shrink-0"
                >
                  {cat.is_active === false ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => setBorrando(cat)}
                  title="Eliminar"
                  className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={cerrar}>
          Listo
        </Button>
      </div>

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrado}
        title="Eliminar categoría"
        message={`Se elimina "${borrando?.name}". Si tiene productos cargados, no se va a poder borrar hasta moverlos a otra categoría.`}
        confirmText="Eliminar"
      />
    </Modal>
  );
};

export default CategoriasModal;
