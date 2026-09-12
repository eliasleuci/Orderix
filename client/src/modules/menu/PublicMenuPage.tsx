import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapPin, Phone, UtensilsCrossed, ImageOff } from 'lucide-react';
import { menuService, Carta } from '../../services/menuService';

const PublicMenuPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sucursalId = searchParams.get('sucursal') ?? undefined;

  const [carta, setCarta] = useState<Carta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  const seccionesRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!slug) return;
    let vigente = true;

    setLoading(true);
    menuService.getCartaPublica(slug, sucursalId).then(({ data, error }) => {
      if (!vigente) return;
      setCarta(data);
      setError(error);
      setCategoriaActiva(data?.categorias[0]?.id ?? null);
      setLoading(false);
    });

    return () => { vigente = false; };
  }, [slug, sucursalId]);

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

  return (
    <div className="min-h-screen bg-surface-base text-text-primary pb-16">
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
                    <li
                      key={p.id}
                      className="flex items-center gap-4 bg-surface-elevated/40 border border-white/5 rounded-3xl p-3"
                    >
                      <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-white/5 flex items-center justify-center">
                        {p.imagen ? (
                          <img src={p.imagen} alt={p.nombre} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <ImageOff size={22} className="text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black tracking-tight leading-tight">{p.nombre}</h3>
                      </div>
                      <span className="text-lg font-black text-primary tracking-tighter shrink-0">
                        ${p.precio.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
        </>
      )}

      <footer className="max-w-3xl mx-auto px-6 pt-16 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Los precios pueden variar sin previo aviso
        </p>
      </footer>
    </div>
  );
};

export default PublicMenuPage;
