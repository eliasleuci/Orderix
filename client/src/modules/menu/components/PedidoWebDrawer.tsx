import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Minus, Plus, ArrowLeft, Send, CheckCircle2, Bike, ShoppingBag } from 'lucide-react';
import { useWebCartStore } from '../../../store/webCartStore';
import {
  webshopService,
  mensajeDeWhatsapp,
  linkDeWhatsapp,
  Vidriera,
  PedidoWeb,
} from '../../../services/webshopService';
import MapaDireccion from './MapaDireccion';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  vidriera: Vidriera;
  slug: string;
}

type Paso = 'carrito' | 'datos' | 'enviado';

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

const PedidoWebDrawer: React.FC<Props> = ({ abierto, onCerrar, vidriera, slug }) => {
  const { items, cambiarCantidad, quitar, total, vaciar, clave, descartarClave } = useWebCartStore();
  const config = vidriera.pedidos;

  const [paso, setPaso] = useState<Paso>('carrito');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoWeb | null>(null);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipo, setTipo] = useState<'DELIVERY' | 'TAKEAWAY'>(
    config.permiteEnvio ? 'DELIVERY' : 'TAKEAWAY'
  );
  const [direccion, setDireccion] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [referencia, setReferencia] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [pago, setPago] = useState<'CASH' | 'TRANSFER'>(config.aceptaEfectivo ? 'CASH' : 'TRANSFER');
  const [nota, setNota] = useState('');

  const subtotal = total();
  const envio = useMemo(() => {
    if (tipo !== 'DELIVERY') return 0;
    return vidriera.zonas.find((z) => z.id === zonaId)?.precio ?? 0;
  }, [tipo, zonaId, vidriera.zonas]);

  const faltaParaElMinimo = Math.max(0, config.minimo - subtotal);

  const enviar = async () => {
    setError(null);

    if (nombre.trim().length < 2) return setError('Poné tu nombre y apellido');
    if (telefono.replace(/\D/g, '').length < 6) return setError('Poné un teléfono de contacto');
    if (tipo === 'DELIVERY' && !direccion.trim()) return setError('Poné la dirección de entrega');
    if (tipo === 'DELIVERY' && !zonaId) return setError('Elegí la zona de envío');
    if (faltaParaElMinimo > 0) return setError(`El pedido mínimo es ${plata(config.minimo)}`);

    setEnviando(true);
    const { data, error: err } = await webshopService.enviarPedido(slug, vidriera.sucursalActual.id, {
      // La misma clave si el cliente reintenta: el local no puede recibir el
      // pedido dos veces por haber vuelto atrás desde WhatsApp.
      idempotencyKey: clave(),
      customerName: nombre,
      customerPhone: telefono.replace(/\D/g, ''),
      // La referencia va pegada a la dirección: el pedido en la base tiene un
      // solo campo de texto, no columnas separadas por calle/barrio/referencia.
      customerAddress: tipo === 'DELIVERY'
        ? `${direccion.trim()}${referencia.trim() ? ` (${referencia.trim()})` : ''}`
        : null,
      customerLat: tipo === 'DELIVERY' ? coordenadas?.lat ?? null : null,
      customerLng: tipo === 'DELIVERY' ? coordenadas?.lng ?? null : null,
      orderType: tipo,
      paymentMethod: pago,
      deliveryZoneId: tipo === 'DELIVERY' ? zonaId : null,
      notes: nota || null,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.cantidad,
        notes: i.notas ?? null,
        modifierOptionIds: i.extras?.map((e) => e.optionId),
      })),
    });
    setEnviando(false);

    if (err || !data) return setError(err ?? 'No se pudo enviar el pedido');

    setPedido(data.pedido);
    setPaso('enviado');
    // El pedido ya está en el sistema del local: el carrito se vacía acá y no
    // al volver de WhatsApp, porque puede que el cliente nunca vuelva.
    vaciar();
    descartarClave();
  };

  const abrirWhatsapp = () => {
    if (!pedido || !config.whatsapp) return;
    window.location.href = linkDeWhatsapp(config.whatsapp, mensajeDeWhatsapp(pedido, vidriera.local.nombre));
  };

  const cerrarTodo = () => {
    setPaso('carrito');
    setPedido(null);
    setError(null);
    onCerrar();
  };

  const campo =
    'w-full bg-surface-base border border-white/10 rounded-2xl h-12 px-4 text-text-primary text-sm focus:outline-none focus:border-primary';

  return (
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={paso === 'enviado' ? undefined : onCerrar}
            className="absolute inset-0 bg-black/70"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-lg bg-surface-elevated rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/10 max-h-[92vh] flex flex-col"
          >
            <header className="flex items-center justify-between gap-3 p-5 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {paso === 'datos' && (
                  <button onClick={() => setPaso('carrito')} className="p-2 -ml-2 rounded-xl hover:bg-white/5">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h2 className="text-lg font-black uppercase tracking-tighter truncate">
                  {paso === 'carrito' ? 'Tu pedido' : paso === 'datos' ? 'Tus datos' : '¡Pedido enviado!'}
                </h2>
              </div>
              <button onClick={cerrarTodo} className="p-2 rounded-xl bg-white/5 text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {/* ---------- CARRITO ---------- */}
              {paso === 'carrito' && (
                items.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-12">
                    Todavía no agregaste nada.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {items.map((i) => (
                      <li key={i.lineaId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-base p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{i.nombre}</p>
                          {i.extras && i.extras.length > 0 && (
                            <p className="text-[11px] text-text-secondary mt-0.5">
                              {i.extras.map((e) => e.nombre).join(", ")}
                            </p>
                          )}
                          {i.notas && <p className="text-[11px] text-text-muted italic mt-0.5">{i.notas}</p>}
                          <p className="text-xs text-primary font-black mt-1">{plata(i.precio * i.cantidad)}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => cambiarCantidad(i.lineaId, i.cantidad - 1)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-7 text-center font-black text-sm tabular-nums">{i.cantidad}</span>
                          <button
                            onClick={() => cambiarCantidad(i.lineaId, i.cantidad + 1)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => quitar(i.lineaId)}
                            className="w-8 h-8 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 flex items-center justify-center ml-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {/* ---------- DATOS ---------- */}
              {paso === 'datos' && (
                <div className="space-y-4">
                  <input className={campo} placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  <input
                    className={campo}
                    type="tel"
                    inputMode="tel"
                    placeholder="Teléfono de contacto"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">¿Cómo lo querés?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {config.permiteEnvio && (
                        <button
                          onClick={() => setTipo('DELIVERY')}
                          className={`py-3 rounded-2xl border text-xs font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 ${
                            tipo === 'DELIVERY' ? 'bg-primary text-white border-primary' : 'bg-surface-base border-white/10 text-text-muted'
                          }`}
                        >
                          <Bike size={15} /> Envío
                        </button>
                      )}
                      {config.permiteRetiro && (
                        <button
                          onClick={() => setTipo('TAKEAWAY')}
                          className={`py-3 rounded-2xl border text-xs font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 ${
                            tipo === 'TAKEAWAY' ? 'bg-primary text-white border-primary' : 'bg-surface-base border-white/10 text-text-muted'
                          }`}
                        >
                          <ShoppingBag size={15} /> Retiro
                        </button>
                      )}
                    </div>
                  </div>

                  {tipo === 'DELIVERY' && (
                    <>
                      <MapaDireccion
                        direccion={direccion}
                        onDireccionChange={setDireccion}
                        coordenadas={coordenadas}
                        onCoordenadasChange={setCoordenadas}
                      />
                      <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} className={`${campo} appearance-none`}>
                        <option value="">Elegí tu barrio o zona...</option>
                        {vidriera.zonas.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.nombre} — {plata(z.precio)}
                          </option>
                        ))}
                      </select>
                      <input
                        className={campo}
                        placeholder="Referencias (piso, timbre, entre calles...)"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                      />
                    </>
                  )}

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">¿Cómo pagás?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {config.aceptaEfectivo && (
                        <button
                          onClick={() => setPago('CASH')}
                          className={`py-3 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                            pago === 'CASH' ? 'bg-primary text-white border-primary' : 'bg-surface-base border-white/10 text-text-muted'
                          }`}
                        >
                          Efectivo
                        </button>
                      )}
                      {config.aceptaTransferencia && (
                        <button
                          onClick={() => setPago('TRANSFER')}
                          className={`py-3 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                            pago === 'TRANSFER' ? 'bg-primary text-white border-primary' : 'bg-surface-base border-white/10 text-text-muted'
                          }`}
                        >
                          Transferencia
                        </button>
                      )}
                    </div>
                    {pago === 'TRANSFER' && config.datosTransferencia && (
                      <p className="text-xs text-text-secondary mt-2 rounded-2xl border border-white/5 bg-surface-base px-4 py-3">
                        {config.datosTransferencia}
                      </p>
                    )}
                  </div>

                  <input
                    className={campo}
                    placeholder="Alguna aclaración (opcional)"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              )}

              {/* ---------- ENVIADO ---------- */}
              {paso === 'enviado' && pedido && (
                <div className="text-center py-4">
                  <CheckCircle2 size={56} className="text-success mx-auto mb-4" />
                  <p className="text-2xl font-black tracking-tighter">Pedido #{pedido.codigo}</p>
                  <p className="text-text-secondary text-sm mt-3 max-w-xs mx-auto">
                    Ya le llegó a {vidriera.local.nombre}. Mandales el mensaje por WhatsApp para
                    confirmarlo y sacarte cualquier duda.
                  </p>
                  {config.minutosPreparacion && (
                    <p className="text-xs text-text-muted mt-3">
                      Tiempo estimado: {config.minutosPreparacion} minutos
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-danger text-sm font-bold mt-4 text-center">{error}</p>
              )}
            </div>

            <footer className="p-5 border-t border-white/5 shrink-0 space-y-3">
              {paso !== 'enviado' && items.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Productos</span>
                    <span className="font-bold">{plata(subtotal)}</span>
                  </div>
                  {envio > 0 && (
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>Envío</span>
                      <span className="font-bold">{plata(envio)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Total</span>
                    <span className="text-2xl font-black text-primary tracking-tighter">{plata(subtotal + envio)}</span>
                  </div>

                  {faltaParaElMinimo > 0 && (
                    <p className="text-xs text-warning font-bold text-center">
                      Te faltan {plata(faltaParaElMinimo)} para el pedido mínimo
                    </p>
                  )}
                </>
              )}

              {paso === 'carrito' && (
                <button
                  disabled={items.length === 0 || faltaParaElMinimo > 0}
                  onClick={() => setPaso('datos')}
                  className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  Continuar
                </button>
              )}

              {paso === 'datos' && (
                <button
                  disabled={enviando}
                  onClick={enviar}
                  className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm disabled:opacity-40 inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Send size={17} /> {enviando ? 'Enviando...' : 'Confirmar pedido'}
                </button>
              )}

              {paso === 'enviado' && (
                <>
                  {config.whatsapp && (
                    <button
                      onClick={abrirWhatsapp}
                      className="w-full h-14 rounded-2xl bg-[#25D366] text-black font-black uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <Send size={17} /> Mandar por WhatsApp
                    </button>
                  )}
                  <button onClick={cerrarTodo} className="w-full h-12 rounded-2xl text-text-muted font-bold text-sm">
                    Seguir mirando la carta
                  </button>
                </>
              )}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PedidoWebDrawer;
