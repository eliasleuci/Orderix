import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, UtensilsCrossed, ImageOff, ChevronDown, Plus, ShoppingCart } from 'lucide-react';
import { webshopService, Vidriera, ProductoVidriera } from '../../services/webshopService';
import { useWebCartStore } from '../../store/webCartStore';
import PedidoWebDrawer from './components/PedidoWebDrawer';

const ProductoItem: React.FC<{
  producto: ProductoVidriera;
  sePuedePedir: boolean;
  onAgregar: (p: ProductoVidriera, notas: string) => void;
}> = ({ producto, sePuedePedir, onAgregar }) => {
  const [abierto, setAbierto] = useState(false);
  const [notas, setNotas] = useState('');

  const tieneDetalle = Boolean(producto.descripcion) || producto.ingredientes.length > 0;

  const cabecera = (
    <>
      <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <ImageOff size={22} className="text-text-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-black tracking-tight leading-tight">{producto.nombre}</h3>
        {producto.descripcion && !abierto && (
          <p className="text-text-secondary text-xs mt-1 leading-snug line-clamp-1">{producto.descripcion}</p>
        )}
        {tieneDetalle && (
          <span className="inline-flex items-center gap-1 text-primary text-[10px] font-black uppercase tracking-widest mt-1.5">
            {abierto ? 'Ocultar' : 'Ver detalle'}
            <ChevronDown size={12} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </span>
        )}
      </div>

      <span className="text-lg font-black text-primary tracking-tighter shrink-0">
        ${producto.precio.toLocaleString()}
      </span>
    </>
  );

  return (
    <li className="bg-surface-elevated/40 border border-white/5 rounded-3xl overflow-hidden">
      {tieneDetalle ? (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="w-full flex items-center gap-4 p-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          {cabecera}
        </button>
      ) : (
        <div className="flex items-center gap-4 p-3">
          {cabecera}
          {sePuedePedir && (
            <button
              onClick={() => onAgregar(producto, '')}
              title="Agregar"
              className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4 pt-1 space-y-4 border-t border-white/5 mt-1">
              {producto.descripcion && (
                <p className="text-text-secondary text-sm leading-relaxed pt-3">{producto.descripcion}</p>
              )}

              {producto.ingredientes.length > 0 && (
                <div className={producto.descripcion ? '' : 'pt-3'}>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Lleva</h4>
                  <ul className="flex flex-wrap gap-2">
                    {producto.ingredientes.map((i) => (
                      <li
                        key={i}
                        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-text-secondary"
                      >
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sePuedePedir && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Alguna aclaración (opcional)"
                    maxLength={200}
                    className="flex-1 bg-surface-base border border-white/10 rounded-2xl h-11 px-4 text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => { onAgregar(producto, notas); setNotas(''); setAbierto(false); }}
                    className="h-11 px-5 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] inline-flex items-center justify-center gap-1.5 active:scale-95 transition-transform shrink-0"
                  >
                    <Plus size={15} /> Agregar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

interface Props {
  /** Sin esto en true, la página nunca ofrece pedir: es la carta de sólo
      lectura que apunta el QR de las mesas. */
  modoPedido?: boolean;
}

const PublicMenuPage: React.FC<Props> = ({ modoPedido = false }) => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sucursalId = searchParams.get('sucursal') ?? undefined;

  const [carta, setCarta] = useState<Vidriera | null>(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const { abrirLocal, agregar, unidades, total } = useWebCartStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  const seccionesRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!slug) return;
    let vigente = true;

    setLoading(true);
    webshopService.getVidriera(slug, sucursalId).then(({ data, error }) => {
      if (!vigente) return;
      setCarta(data);
      setError(error);
      setCategoriaActiva(data?.categorias[0]?.id ?? null);
      setLoading(false);
    });

    return () => { vigente = false; };
  }, [slug, sucursalId]);

  // Entrar a otro local arranca con el carrito vacío: lo que había adentro no
  // existe en esta carta.
  useEffect(() => {
    if (slug) abrirLocal(slug);
  }, [slug, abrirLocal]);

  // La categoría activa se marca según qué sección quedó arriba de todo, para
  // que la barra de categorías acompañe al scroll en vez de quedarse fija.
  useEffect(() => {
    if (!carta) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setCategoriaActiva(visible.target.id);
      },
      { rootMargin: '-96px 0px -70% 0px' }
    );

    Object.values(seccionesRef.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [carta]);

  const irACategoria = useCallback((id: string) => {
    seccionesRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !carta) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6 text-center">
        <div>
          <UtensilsCrossed size={48} className="text-text-muted mx-auto mb-4" />
          <h1 className="text-2xl font-black uppercase tracking-tighter text-text-primary mb-2">
            Carta no disponible
          </h1>
          <p className="text-text-secondary text-sm max-w-xs">
            {error ?? 'Este local todavía no publicó su carta.'}
          </p>
        </div>
      </div>
    );
  }

  const sinProductos = carta.categorias.length === 0;
  // Sólo se puede pedir si el local prendió el canal y no lo pausó. Con esto en
  // false la página queda exactamente como la carta de sólo lectura de siempre.
  // El canal puede estar prendido en la configuración del local y esta
  // pantalla igual no ofrecer pedir: /carta es sólo lectura siempre, sin
  // importar la config. Sólo /pedir puede vender.
  const sePuedePedir = modoPedido && carta.pedidos.habilitado && Boolean(carta.pedidos.whatsapp);
  const enElCarrito = unidades();

  return (
    <div className={`min-h-screen bg-surface-base text-text-primary ${sePuedePedir ? 'pb-32' : 'pb-16'}`}>
      <header className="relative overflow-hidden border-b border-white/5 px-6 pt-12 pb-8">
        <div className="absolute -top-32 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-primary mb-3">
            <UtensilsCrossed size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Nuestra carta</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-none mb-4">
            {carta.local.nombre}
          </h1>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-text-secondary text-xs font-bold">
            {carta.sucursalActual.direccion && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-text-muted" />
                {carta.sucursalActual.direccion}
              </span>
            )}
            {carta.sucursalActual.telefono && (
              <a
                href={`tel:${carta.sucursalActual.telefono}`}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Phone size={14} className="text-text-muted" />
                {carta.sucursalActual.telefono}
              </a>
            )}
          </div>

          {carta.sucursales.length > 1 && (
            <select
              value={carta.sucursalActual.id}
              onChange={(e) => setSearchParams({ sucursal: e.target.value })}
              className="mt-5 bg-surface-elevated border border-white/10 rounded-2xl h-11 px-4 text-text-primary text-xs font-black uppercase tracking-widest focus:outline-none focus:border-primary"
            >
              {carta.sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {sinProductos ? (
        <p className="max-w-3xl mx-auto px-6 py-20 text-center text-text-secondary text-sm">
          Todavía no hay productos cargados en esta carta.
        </p>
      ) : (
        <>
          <nav className="sticky top-0 z-20 bg-surface-base/90 backdrop-blur-md border-b border-white/5">
            <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-none px-6 py-3">
              {carta.categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irACategoria(c.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                    categoriaActiva === c.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </nav>

          <main className="max-w-3xl mx-auto px-6">
            {carta.categorias.map((c) => (
              <section
                key={c.id}
                id={c.id}
                ref={(el) => { seccionesRef.current[c.id] = el; }}
                className="pt-10 scroll-mt-20"
              >
                <h2 className="text-xl font-black uppercase tracking-tighter mb-5">{c.nombre}</h2>

                <ul className="space-y-3">
                  {c.productos.map((p) => (
                    <ProductoItem
                      key={p.id}
                      producto={p}
                      sePuedePedir={sePuedePedir}
                      onAgregar={(prod, notas) =>
                        agregar({
                          productId: prod.id,
                          nombre: prod.nombre,
                          precio: prod.precio,
                          imagen: prod.imagen,
                          notas,
                        })
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
          </main>
        </>
      )}

      {/* Aviso de que el local no está tomando pedidos ahora mismo. La carta se
          puede seguir mirando: cerrar no es lo mismo que no existir. */}
      {carta.pedidos.pausado && (
        <div className="max-w-3xl mx-auto px-6 pt-8">
          <p className="rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-bold text-warning text-center">
            En este momento no estamos tomando pedidos online. Podés ver la carta igual.
          </p>
        </div>
      )}

      <footer className="max-w-3xl mx-auto px-6 pt-16 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Los precios pueden variar sin previo aviso
        </p>
      </footer>

      {/* Barra del carrito: fija abajo para que esté siempre a mano mientras se
          recorre la carta desde el celular. */}
      {sePuedePedir && enElCarrito > 0 && !carritoAbierto && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="w-full max-w-3xl mx-auto h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 flex items-center justify-between px-5 active:scale-[0.98] transition-transform"
          >
            <span className="inline-flex items-center gap-2.5">
              <ShoppingCart size={18} />
              {enElCarrito} {enElCarrito === 1 ? 'producto' : 'productos'}
            </span>
            <span className="tracking-tighter text-base">${total().toLocaleString()}</span>
          </button>
        </div>
      )}

      {sePuedePedir && (
        <PedidoWebDrawer
          abierto={carritoAbierto}
          onCerrar={() => setCarritoAbierto(false)}
          vidriera={carta}
          slug={slug!}
        />
      )}
    </div>
  );
};

export default PublicMenuPage;
