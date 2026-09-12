import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical, Pencil, Check, X, Copy, Search } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { modifierService, GrupoDeExtras, OpcionDeExtra } from '../../../services/modifierService';
import { productService } from '../../../services/productService';
import { Product } from '../../../types/domain';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ConfirmModal from '../../../components/ui/ConfirmModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onAviso: (mensaje: string, tipo: 'success' | 'error') => void;
}

type Seleccion = 'una' | 'varias';

/**
 * Extras propios de UN producto: cada uno se carga desde cero, sin compartir
 * grupos con otros. Sólo alimenta el pedido web por ahora; Ventas sigue con su
 * sistema de modificadores actual, sin tocar.
 */
const ExtrasModal: React.FC<Props> = ({ isOpen, onClose, productId, productName, onAviso }) => {
  const { branchId, tenantId } = useAuthStore();

  const [grupos, setGrupos] = useState<GrupoDeExtras[]>([]);
  const [opciones, setOpciones] = useState<Record<string, OpcionDeExtra[]>>({});
  const [cargando, setCargando] = useState(false);

  const [nuevoGrupo, setNuevoGrupo] = useState('');
  const [nuevaOpcion, setNuevaOpcion] = useState<Record<string, { nombre: string; precio: string }>>({});
  const [editandoOpcion, setEditandoOpcion] = useState<string | null>(null);
  const [precioEditado, setPrecioEditado] = useState('');
  const [borrando, setBorrando] = useState<{ tipo: 'grupo' | 'opcion'; id: string; nombre: string } | null>(null);

  // Copiar un grupo ya armado a otros productos, para no tipear la misma
  // lista de extras producto por producto cuando varios comparten los mismos.
  const [copiando, setCopiando] = useState<GrupoDeExtras | null>(null);
  const [productos, setProductos] = useState<Product[]>([]);
  const [buscarProducto, setBuscarProducto] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [copiandoGuardando, setCopiandoGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data: gs } = await modifierService.getGrupos(productId);
    const listaGrupos = gs ?? [];
    setGrupos(listaGrupos);

    const { data: os } = await modifierService.getOpciones(listaGrupos.map((g) => g.id));
    const porGrupo: Record<string, OpcionDeExtra[]> = {};
    for (const o of os ?? []) {
      (porGrupo[o.group_id] ??= []).push(o);
    }
    setOpciones(porGrupo);
    setCargando(false);
  }, [productId]);

  useEffect(() => {
    if (isOpen) cargar();
  }, [isOpen, cargar]);

  useEffect(() => {
    if (!branchId) return;
    productService.getBranchProducts(branchId).then(({ data }) => {
      setProductos((data ?? []).filter((p) => p.id !== productId));
    });
  }, [branchId, productId]);

  const agregarGrupo = async () => {
    const nombre = nuevoGrupo.trim();
    if (!nombre) return onAviso('Poné un nombre para el grupo', 'error');

    const { error } = await modifierService.crearGrupo({
      tenant_id: tenantId!,
      branch_id: branchId!,
      product_id: productId,
      name: nombre,
      min_select: 0,
      max_select: null,
    });
    if (error) return onAviso(error, 'error');

    setNuevoGrupo('');
    cargar();
  };

  const cambiarSeleccion = async (g: GrupoDeExtras, seleccion: Seleccion) => {
    const cambios =
      seleccion === 'una'
        ? { max_select: 1 }
        : { max_select: null };
    const { error } = await modifierService.actualizarGrupo(g.id, cambios);
    if (error) return onAviso(error, 'error');
    cargar();
  };

  const cambiarObligatorio = async (g: GrupoDeExtras) => {
    const { error } = await modifierService.actualizarGrupo(g.id, {
      min_select: g.min_select > 0 ? 0 : 1,
    });
    if (error) return onAviso(error, 'error');
    cargar();
  };

  const agregarOpcion = async (grupoId: string) => {
    const datos = nuevaOpcion[grupoId] ?? { nombre: '', precio: '' };
    const nombre = datos.nombre.trim();
    if (!nombre) return onAviso('Poné un nombre para la opción', 'error');

    const precio = parseFloat(datos.precio);
    const { error } = await modifierService.crearOpcion({
      tenant_id: tenantId!,
      group_id: grupoId,
      name: nombre,
      price: Number.isFinite(precio) && precio >= 0 ? precio : 0,
    });
    if (error) return onAviso(error, 'error');

    setNuevaOpcion((prev) => ({ ...prev, [grupoId]: { nombre: '', precio: '' } }));
    cargar();
  };

  const guardarPrecio = async (opcionId: string) => {
    const precio = parseFloat(precioEditado);
    const { error } = await modifierService.actualizarOpcion(opcionId, {
      price: Number.isFinite(precio) && precio >= 0 ? precio : 0,
    });
    setEditandoOpcion(null);
    if (error) return onAviso(error, 'error');
    cargar();
  };

  const abrirCopiar = (g: GrupoDeExtras) => {
    setCopiando(g);
    setSeleccionados(new Set());
    setBuscarProducto('');
  };

  const alternarSeleccionado = (id: string) => {
    setSeleccionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const confirmarCopia = async () => {
    if (!copiando || seleccionados.size === 0) return;

    setCopiandoGuardando(true);
    const { data: copiados, error } = await modifierService.copiarGrupoAProductos(
      copiando,
      opciones[copiando.id] ?? [],
      [...seleccionados],
      tenantId!
    );
    setCopiandoGuardando(false);
    setCopiando(null);

    if (error) return onAviso(error, 'error');
    onAviso(`Copiado a ${copiados} ${copiados === 1 ? 'producto' : 'productos'}`, 'success');
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const { error } =
      borrando.tipo === 'grupo'
        ? await modifierService.borrarGrupo(borrando.id)
        : await modifierService.borrarOpcion(borrando.id);

    setBorrando(null);
    if (error) return onAviso(error, 'error');
    cargar();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extras" maxWidth="lg">
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Extras de <b>{productName}</b>. Se muestran en el pedido web para que el cliente
          personalice antes de agregarlo al carrito.
        </p>

        <div className="flex gap-3">
          <Input
            placeholder='Nombre del grupo, ej: "Agranda tu burger"'
            value={nuevoGrupo}
            onChange={(e) => setNuevoGrupo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarGrupo()}
            className="flex-1"
          />
          <Button leftIcon={<Plus size={18} />} onClick={agregarGrupo}>
            Grupo
          </Button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : grupos.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">
            Todavía no hay grupos de extras para este producto.
          </p>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => {
              const seleccion: Seleccion = g.max_select === 1 ? 'una' : 'varias';
              const opcionesDelGrupo = opciones[g.id] ?? [];
              const form = nuevaOpcion[g.id] ?? { nombre: '', precio: '' };

              return (
                <div key={g.id} className="rounded-3xl border border-white/10 bg-surface-base p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={16} className="text-text-muted shrink-0" />
                      <h3 className="font-black tracking-tight truncate">{g.name}</h3>
                    </div>
                    <button
                      onClick={() => abrirCopiar(g)}
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      title="Copiar a otros productos"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => setBorrando({ tipo: 'grupo', id: g.id, nombre: g.name })}
                      className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                      title="Eliminar grupo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => cambiarSeleccion(g, 'una')}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        seleccion === 'una' ? 'bg-primary text-white border-primary' : 'border-white/10 text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Elegir una sola
                    </button>
                    <button
                      onClick={() => cambiarSeleccion(g, 'varias')}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        seleccion === 'varias' ? 'bg-primary text-white border-primary' : 'border-white/10 text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Puede elegir varias
                    </button>
                    <button
                      onClick={() => cambiarObligatorio(g)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        g.min_select > 0 ? 'bg-warning/20 text-warning border-warning/30' : 'border-white/10 text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {g.min_select > 0 ? 'Obligatorio' : 'Opcional'}
                    </button>
                  </div>

                  <div className="space-y-2 mb-3">
                    {opcionesDelGrupo.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-elevated/50 px-4 py-2.5">
                        <span className="flex-1 text-sm font-bold truncate">{o.name}</span>

                        {editandoOpcion === o.id ? (
                          <>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={precioEditado}
                              onChange={(e) => setPrecioEditado(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && guardarPrecio(o.id)}
                              className="w-28 h-9 px-3 py-0 text-sm"
                              autoFocus
                            />
                            <button onClick={() => guardarPrecio(o.id)} className="p-1.5 text-success">
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditandoOpcion(null)} className="p-1.5 text-text-muted">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditandoOpcion(o.id); setPrecioEditado(String(o.price)); }}
                              className="inline-flex items-center gap-1.5 text-sm font-black text-primary hover:bg-white/5 px-2 py-1 rounded-lg"
                            >
                              {o.price > 0 ? `+$${o.price.toLocaleString()}` : 'Sin costo'}
                              <Pencil size={12} className="text-text-muted" />
                            </button>
                            <button
                              onClick={() => setBorrando({ tipo: 'opcion', id: o.id, nombre: o.name })}
                              className="p-1.5 text-text-muted hover:text-danger transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre de la opción"
                      value={form.nombre}
                      onChange={(e) => setNuevaOpcion((prev) => ({ ...prev, [g.id]: { ...form, nombre: e.target.value } }))}
                      onKeyDown={(e) => e.key === 'Enter' && agregarOpcion(g.id)}
                      className="flex-1 h-10 py-0"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="Precio"
                      value={form.precio}
                      onChange={(e) => setNuevaOpcion((prev) => ({ ...prev, [g.id]: { ...form, precio: e.target.value } }))}
                      onKeyDown={(e) => e.key === 'Enter' && agregarOpcion(g.id)}
                      className="w-28 h-10 py-0"
                    />
                    <Button size="md" className="h-10" onClick={() => agregarOpcion(g.id)} leftIcon={<Plus size={16} />}>
                      Opción
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={onClose}>
          Listo
        </Button>
      </div>

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrado}
        title={borrando?.tipo === 'grupo' ? 'Eliminar grupo' : 'Eliminar opción'}
        message={
          borrando?.tipo === 'grupo'
            ? `Se elimina "${borrando?.nombre}" y todas sus opciones.`
            : `Se elimina "${borrando?.nombre}".`
        }
        confirmText="Eliminar"
      />

      <Modal
        isOpen={Boolean(copiando)}
        onClose={() => setCopiando(null)}
        title={`Copiar "${copiando?.name}"`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Se crea una copia de este grupo y sus opciones en cada producto que elijas. Son
            copias independientes: si después cambiás un precio acá, no se actualiza en las
            demás.
          </p>

          <Input
            placeholder="Buscar producto..."
            icon={<Search size={16} />}
            value={buscarProducto}
            onChange={(e) => setBuscarProducto(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto space-y-1 rounded-2xl border border-white/10 p-2">
            {productos
              .filter((p) => p.name.toLowerCase().includes(buscarProducto.toLowerCase()))
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(p.id)}
                    onChange={() => alternarSeleccionado(p.id)}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm truncate">{p.name}</span>
                </label>
              ))}
            {productos.length === 0 && (
              <p className="text-text-muted text-sm text-center py-6">No hay otros productos.</p>
            )}
          </div>

          <Button
            fullWidth
            disabled={seleccionados.size === 0 || copiandoGuardando}
            onClick={confirmarCopia}
          >
            {copiandoGuardando
              ? 'Copiando...'
              : `Copiar a ${seleccionados.size || ''} ${seleccionados.size === 1 ? 'producto' : 'productos'}`}
          </Button>
        </div>
      </Modal>
    </Modal>
  );
};

export default ExtrasModal;
