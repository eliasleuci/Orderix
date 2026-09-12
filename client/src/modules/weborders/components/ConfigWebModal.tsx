import React, { useCallback, useEffect, useState } from 'react';
import { Save, Copy, Check, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { webConfigService, ConfigWeb } from '../../../services/webshopService';
import { menuService } from '../../../services/menuService';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAviso: (mensaje: string, tipo: 'success' | 'error') => void;
}

const Switch: React.FC<{
  activo: boolean;
  onToggle: () => void;
  titulo: string;
  detalle: string;
}> = ({ activo, onToggle, titulo, detalle }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all text-left ${
      activo ? 'border-primary bg-primary/10' : 'border-border-subtle bg-surface-base hover:border-primary/40'
    }`}
  >
    <span className="min-w-0">
      <span className="block font-black text-sm">{titulo}</span>
      <span className="block text-xs text-text-muted mt-0.5">{detalle}</span>
    </span>
    <span className={`w-12 h-7 rounded-full shrink-0 transition-colors relative ${activo ? 'bg-primary' : 'bg-white/10'}`}>
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${activo ? 'left-6' : 'left-1'}`} />
    </span>
  </button>
);

const ConfigWebModal: React.FC<Props> = ({ isOpen, onClose, onAviso }) => {
  const { branchId, tenantId } = useAuthStore();

  const [config, setConfig] = useState<ConfigWeb | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [telefono, setTelefono] = useState('');
  const [minimo, setMinimo] = useState('');
  const [minutos, setMinutos] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    if (!branchId) return;
    const [{ data }, { data: enlace }] = await Promise.all([
      webConfigService.get(branchId),
      menuService.getEnlace(),
    ]);

    setConfig(data);
    setSlug(enlace?.slug ?? null);
    // Los numéricos van como texto: con un number, borrar el campo deja '' y
    // Number('') es 0, así que el 0 vuelve solo y no se puede escribir otro.
    setTelefono(data?.whatsapp_phone ?? '');
    setMinimo(data?.min_order ? String(data.min_order) : '');
    setMinutos(data?.prep_minutes ? String(data.prep_minutes) : '');
  }, [branchId]);

  useEffect(() => {
    if (isOpen) cargar();
  }, [isOpen, cargar]);

  // /pedir y no /carta: son links distintos a propósito. El de la carta es el
  // que ya está impreso en las mesas y tiene que quedar de sólo lectura para
  // siempre; éste es el que el local comparte para vender online.
  const url = slug ? `${window.location.origin}/pedir/${slug}` : '';

  const guardar = async () => {
    if (!config) return;

    const soloDigitos = telefono.replace(/\D/g, '');
    // Lo valida la base con un CHECK, pero el mensaje de Postgres no le dice
    // nada a quien está configurando.
    if (config.enabled && soloDigitos.length < 8) {
      return onAviso('Para prender los pedidos hace falta el WhatsApp del local, con código de país', 'error');
    }
    if (config.enabled && !config.accepts_cash && !config.accepts_transfer) {
      return onAviso('Tenés que aceptar al menos una forma de pago', 'error');
    }

    setGuardando(true);
    const { error } = await webConfigService.guardar({
      ...config,
      tenant_id: tenantId!,
      whatsapp_phone: soloDigitos || null,
      min_order: parseFloat(minimo) || 0,
      prep_minutes: parseInt(minutos, 10) || null,
    });
    setGuardando(false);

    if (error) return onAviso(error, 'error');
    onAviso('Configuración guardada', 'success');
    onClose();
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pedidos online" maxWidth="md">
      {!config ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          <Switch
            activo={config.enabled}
            onToggle={() => setConfig({ ...config, enabled: !config.enabled })}
            titulo="Tomar pedidos desde el link"
            detalle={
              config.enabled
                ? 'Los clientes pueden armar el carrito y mandar el pedido'
                : 'Apagado: la carta se ve, pero es de sólo lectura'
            }
          />

          {config.enabled && (
            <>
              <Switch
                activo={config.paused}
                onToggle={() => setConfig({ ...config, paused: !config.paused })}
                titulo="Pausar por hoy"
                detalle="Para cuando no dan abasto. No pierde la configuración."
              />

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                  WhatsApp del local
                </label>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="5493511234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                <p className="text-[10px] text-text-muted mt-1.5">
                  Con código de país y sin el +. Es a donde el cliente manda el pedido.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                    Pedido mínimo
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="0"
                    value={minimo}
                    onChange={(e) => setMinimo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                    Demora estimada (min)
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="Sin informar"
                    value={minutos}
                    onChange={(e) => setMinutos(e.target.value)}
                  />
                </div>
              </div>

              <Switch
                activo={config.takeaway_enabled}
                onToggle={() => setConfig({ ...config, takeaway_enabled: !config.takeaway_enabled })}
                titulo="Permitir retirar por el local"
                detalle="Si está apagado, sólo se puede pedir con envío"
              />

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                  Formas de pago
                </p>
                <Switch
                  activo={config.accepts_cash}
                  onToggle={() => setConfig({ ...config, accepts_cash: !config.accepts_cash })}
                  titulo="Efectivo"
                  detalle="Le paga a quien lleva el pedido, o en el local"
                />
                <Switch
                  activo={config.accepts_transfer}
                  onToggle={() => setConfig({ ...config, accepts_transfer: !config.accepts_transfer })}
                  titulo="Transferencia"
                  detalle="Se arregla con el cliente por WhatsApp"
                />
                {config.accepts_transfer && (
                  <Input
                    placeholder="Alias o CBU que se le muestra al cliente"
                    value={config.transfer_info ?? ''}
                    onChange={(e) => setConfig({ ...config, transfer_info: e.target.value })}
                  />
                )}
              </div>

              {url && (
                <div className="rounded-2xl border border-white/5 bg-surface-base px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                    El link para pedir online
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-text-secondary font-mono truncate">{url}</span>
                    <button onClick={copiar} className="p-1.5 text-text-muted hover:text-primary transition-colors" title="Copiar">
                      {copiado ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-text-muted hover:text-primary transition-colors"
                      title="Abrir"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                  <p className="text-[10px] text-text-muted mt-2">
                    Es un link aparte del de la carta: compartilo por Instagram, WhatsApp o
                    donde publiques tus pedidos. El QR de las mesas sigue siendo sólo para
                    mirar el menú, nunca vende.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 sticky bottom-0 -mx-1 px-1 pt-4 pb-1 bg-surface-elevated border-t border-white/5">
            <Button variant="ghost" onClick={onClose} disabled={guardando}>
              Cerrar
            </Button>
            <Button onClick={guardar} isLoading={guardando} leftIcon={<Save size={18} />}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ConfigWebModal;
