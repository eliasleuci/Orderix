import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Globe, Check, X, MessageCircle, Bike, ShoppingBag, Clock,
  Banknote, Landmark, History, Receipt, AlertTriangle, Settings,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { webshopService, PedidoWeb, linkDeWhatsapp } from '../../services/webshopService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Toast, { ToastType } from '../../components/Toast';
import ConfigWebModal from './components/ConfigWebModal';

const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const WebOrdersPage: React.FC = () => {
  const { branchId, role } = useAuthStore();
  const esAdmin = role === 'ADMIN';
  const [configAbierta, setConfigAbierta] = useState(false);

  const [pedidos, setPedidos] = useState<PedidoWeb[]>([]);
  const [historial, setHistorial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [rechazando, setRechazando] = useState<PedidoWeb | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cambioDePrecio, setCambioDePrecio] = useState<{ pedido: PedidoWeb; cambios: any[] } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cantidadPrevia = useRef(0);

  const sonar = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.volume = 0.6;
    }
    audioRef.current.play().catch(() => {});
  }, []);

  const cargar = useCallback(async (conSonido = false) => {
    const { data, error } = await webshopService.getBandeja(historial);
    if (error) setToast({ message: error, type: 'error' });

    const lista = data ?? [];
    const pendientes = lista.filter((p) => p.estado === 'PENDING').length;

    // Suena sólo si entró uno nuevo, no en la carga inicial: si no, sonaría
    // cada vez que alguien abre la pantalla.
    if (conSonido && pendientes > cantidadPrevia.current) sonar();
    cantidadPrevia.current = pendientes;

    setPedidos(lista);
    setLoading(false);
  }, [historial, sonar]);

  useEffect(() => {
    setLoading(true);
    cargar();
  }, [cargar]);

  // Un pedido que entra tiene que aparecer sin que nadie recargue: es la única
  // forma de que el local se entere si no mira el WhatsApp.
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel(`web-orders-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'web_orders', filter: `branch_id=eq.${branchId}` },
        () => cargar(true)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [branchId, cargar]);

  const confirmar = async (pedido: PedidoWeb, aceptarCambioDePrecio = false) => {
    setProcesando(pedido.id);
    const { data, error } = await webshopService.confirmar(pedido.id, aceptarCambioDePrecio);
    setProcesando(null);

    if (error || !data) return setToast({ message: error ?? 'No se pudo confirmar', type: 'error' });

    if (data.estado === 'precio_cambiado') {
      setCambioDePrecio({ pedido, cambios: data.cambios });
      return;
    }
    if (data.estado === 'productos_no_disponibles') {
      const nombres = (data.faltantes ?? []).map((f: any) => f.producto).join(', ');
      setToast({ message: `Ya no hay: ${nombres}. Avisale al cliente y rechazalo.`, type: 'error' });
      return;
    }

    setCambioDePrecio(null);
    const faltantes = data.advertencias ?? [];
    setToast({
      message: faltantes.length > 0
        ? `Pedido #${pedido.codigo} confirmado. Sin stock: ${faltantes.map((a: any) => a.ingrediente).join(', ')}`
        : `Pedido #${pedido.codigo} confirmado y mandado a cocina`,
      type: faltantes.length > 0 ? 'error' : 'success',
    });
    cargar();
  };

  const rechazar = async () => {
    if (!rechazando) return;
    setProcesando(rechazando.id);
    const { error } = await webshopService.rechazar(rechazando.id, motivo);
    setProcesando(null);
    setRechazando(null);
    setMotivo('');

    if (error) return setToast({ message: error, type: 'error' });
    setToast({ message: 'Pedido rechazado', type: 'success' });
    cargar();
  };

  const contactar = (p: PedidoWeb) => {
    const saludo = `Hola ${p.cliente}! Te escribo por tu pedido #${p.codigo}.`;
    window.open(linkDeWhatsapp(p.telefono, saludo), '_blank');
  };

  const pendientes = pedidos.filter((p) => p.estado === 'PENDING');
  const cerrados = pedidos.filter((p) => p.estado !== 'PENDING');

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tarjeta = (p: PedidoWeb) => {
    const esPendiente = p.estado === 'PENDING';

    return (
      <Card
        key={p.id}
        variant="solid"
        padding="large"
        className={`bg-surface-elevated/40 ${esPendiente ? 'border-primary/30' : 'border-white/5 opacity-70'}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl font-black tracking-tighter">#{p.codigo}</span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                p.tipo === 'DELIVERY'
                  ? 'text-warning border-warning/30 bg-warning/10'
                  : 'text-success border-success/30 bg-success/10'
              }`}>
                {p.tipo === 'DELIVERY' ? <Bike size={11} /> : <ShoppingBag size={11} />}
                {p.tipo === 'DELIVERY' ? 'Envío' : 'Retira'}
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-text-muted">
                {p.formaDePago === 'CASH' ? <Banknote size={11} /> : <Landmark size={11} />}
                {p.formaDePago === 'CASH' ? 'Efectivo' : 'Transfer.'}
              </span>
            </div>

            <p className="font-bold truncate">{p.cliente}</p>
            <p className="text-xs text-text-muted inline-flex items-center gap-1.5 mt-0.5">
              <Clock size={11} /> {hora(p.creadoEn)}
            </p>
            {p.direccion && (
              <p className="text-xs text-text-secondary mt-1">
                📍 {p.direccion}{p.zona ? ` · ${p.zona}` : ''}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-primary tracking-tighter">{plata(p.total)}</p>
            {p.costoEnvio > 0 && (
              <p className="text-[10px] text-text-muted mt-0.5">incluye {plata(p.costoEnvio)} de envío</p>
            )}
          </div>
        </div>

        <ul className="space-y-1.5 rounded-2xl border border-white/5 bg-surface-base px-4 py-3 mb-4">
          {p.items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-bold text-text-muted mr-1.5">{i.cantidad}×</span>
                {i.nombre}
                {i.extras.length > 0 && (
                  <span className="block text-[11px] text-text-secondary mt-0.5">
                    {i.extras.map((e) => e.label).join(", ")}
                  </span>
                )}
                {i.notas && <span className="block text-[11px] text-text-muted italic mt-0.5">{i.notas}</span>}
              </span>
              <span className="text-text-secondary font-bold shrink-0 tabular-nums">{plata(i.subtotal)}</span>
            </li>
          ))}
        </ul>

        {p.notas && (
          <p className="text-xs text-text-secondary italic mb-4 px-1">📝 {p.notas}</p>
        )}

        {p.estado === 'REJECTED' && p.motivoRechazo && (
          <p className="text-xs text-danger mb-4 px-1">Rechazado: {p.motivoRechazo}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => contactar(p)} leftIcon={<MessageCircle size={16} />}>
            WhatsApp
          </Button>

          {esPendiente && (
            <>
              <Button
                variant="success"
                onClick={() => confirmar(p)}
                isLoading={procesando === p.id}
                leftIcon={<Check size={16} />}
              >
                Confirmar
              </Button>
              <Button variant="ghost" onClick={() => setRechazando(p)} leftIcon={<X size={16} />}>
                Rechazar
              </Button>
            </>
          )}

          {p.estado === 'CONFIRMED' && (
            <span className="inline-flex items-center gap-1.5 text-success text-xs font-black uppercase tracking-widest px-3">
              <Check size={14} /> En cocina
            </span>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-4 lg:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 hidden lg:block w-[900px] h-[900px] bg-primary/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 relative z-10">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <Globe size={24} className="text-primary" />
            </div>
            <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Pedidos web</h1>
          </div>
          <p className="text-text-muted text-sm font-medium ml-1">
            Entran desde el link. Confirmalos para mandarlos a cocina.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {esAdmin && (
            <Button variant="secondary" onClick={() => setConfigAbierta(true)} leftIcon={<Settings size={18} />}>
              Configurar
            </Button>
          )}
          <Button
            variant={historial ? 'primary' : 'secondary'}
            onClick={() => setHistorial((v) => !v)}
            leftIcon={<History size={18} />}
          >
            {historial ? 'Sólo pendientes' : 'Historial'}
          </Button>
        </div>
      </header>

      <div className="relative z-10 space-y-8 max-w-4xl">
        {pendientes.length === 0 ? (
          <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40 text-center">
            <Receipt size={40} className="text-text-muted mx-auto mb-4 opacity-40" />
            <p className="text-text-secondary text-sm">
              No hay pedidos esperando confirmación.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">{pendientes.map(tarjeta)}</div>
        )}

        {historial && cerrados.length > 0 && (
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-5">Ya resueltos</h2>
            <div className="space-y-5">{cerrados.map(tarjeta)}</div>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(rechazando)}
        onClose={() => { setRechazando(null); setMotivo(''); }}
        title={`Rechazar pedido #${rechazando?.codigo ?? ''}`}
        maxWidth="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">
            El pedido no va a cocina y no descuenta stock. Conviene avisarle al cliente
            por WhatsApp antes de rechazarlo.
          </p>
          <Input
            placeholder="Motivo (se guarda, no se le manda al cliente)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setRechazando(null); setMotivo(''); }}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={rechazar} isLoading={Boolean(procesando)}>
              Rechazar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Si cambió un precio entre que el cliente pidió y ahora, no se confirma
          solo: el local decide si lo respeta o llama al cliente. */}
      <Modal
        isOpen={Boolean(cambioDePrecio)}
        onClose={() => setCambioDePrecio(null)}
        title="Cambió un precio"
        maxWidth="sm"
      >
        {cambioDePrecio && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary">
                El cliente aceptó un precio y hoy el producto vale otra cosa. Si confirmás,
                se cobra el precio de hoy.
              </p>
            </div>

            <ul className="space-y-2">
              {cambioDePrecio.cambios.map((c: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-surface-base px-4 py-3 text-sm">
                  <span className="font-bold truncate">{c.producto}</span>
                  <span className="shrink-0 text-xs">
                    <span className="text-text-muted line-through">{plata(Number(c.precio_pedido))}</span>
                    <span className="text-primary font-black ml-2">{plata(Number(c.precio_hoy))}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCambioDePrecio(null)}>
                Cancelar
              </Button>
              <Button onClick={() => confirmar(cambioDePrecio.pedido, true)} isLoading={Boolean(procesando)}>
                Confirmar igual
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfigWebModal
        isOpen={configAbierta}
        onClose={() => setConfigAbierta(false)}
        onAviso={(message, type) => setToast({ message, type })}
      />

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default WebOrdersPage;
