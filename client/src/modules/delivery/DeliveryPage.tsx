import React, { useCallback, useEffect, useState } from 'react';
import { Bike, MapPin, Plus, Pencil, Trash2, Ruler, User, Phone, Save } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  deliveryService,
  calcularPrecioPorKm,
  ZonaEnvio,
  Repartidor,
  ConfigEnvio,
} from '../../services/deliveryService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Toast, { ToastType } from '../../components/Toast';

const plata = (n: number) => `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

type Borrando = { tipo: 'zona' | 'repartidor'; id: string; nombre: string } | null;

const DeliveryPage: React.FC = () => {
  const { branchId, tenantId } = useAuthStore();

  const [zonas, setZonas] = useState<ZonaEnvio[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [config, setConfig] = useState<ConfigEnvio | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Los precios de km van como texto y no como número: con un number, borrar
  // el campo deja '' y Number('') es 0, así que el 0 vuelve a aparecer solo y
  // no hay forma de escribir otro valor. Mismo patrón que Caja y el POS.
  const [precioBase, setPrecioBase] = useState('');
  const [precioKm, setPrecioKm] = useState('');
  const [nuevaZona, setNuevaZona] = useState({ nombre: '', precio: '' });
  const [nuevoRepartidor, setNuevoRepartidor] = useState({ nombre: '', telefono: '' });
  const [zonaEditada, setZonaEditada] = useState<ZonaEnvio | null>(null);
  const [repartidorEditado, setRepartidorEditado] = useState<Repartidor | null>(null);
  const [borrando, setBorrando] = useState<Borrando>(null);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const avisar = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const cargar = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const [z, r, c] = await Promise.all([
      deliveryService.getZonas(branchId, true),
      deliveryService.getRepartidores(branchId, true),
      deliveryService.getConfig(branchId),
    ]);
    setZonas(z.data ?? []);
    setRepartidores(r.data ?? []);
    setConfig(c.data);
    setPrecioBase(c.data?.km_base_price ? String(c.data.km_base_price) : '');
    setPrecioKm(c.data?.km_price ? String(c.data.km_price) : '');
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregarZona = async () => {
    const nombre = nuevaZona.nombre.trim();
    const precio = parseFloat(nuevaZona.precio);

    if (!nombre) return avisar('Poné un nombre de zona', 'error');
    if (!Number.isFinite(precio) || precio < 0) return avisar('Poné un precio válido', 'error');

    const { error } = await deliveryService.crearZona({
      tenant_id: tenantId!,
      branch_id: branchId!,
      name: nombre,
      price: precio,
    });

    if (error) {
      // El índice único de la base es lo que impide dos zonas con el mismo
      // nombre; el mensaje crudo de Postgres no le dice nada a quien carga.
      return avisar(
        error.includes('duplicate') || error.includes('idx_delivery_zones_nombre')
          ? `Ya existe una zona llamada "${nombre}"`
          : error,
        'error'
      );
    }

    setNuevaZona({ nombre: '', precio: '' });
    avisar('Zona agregada');
    cargar();
  };

  const guardarZona = async () => {
    if (!zonaEditada) return;
    const { error } = await deliveryService.actualizarZona(zonaEditada.id, {
      name: zonaEditada.name.trim(),
      price: Number(zonaEditada.price),
    });
    if (error) return avisar(error, 'error');

    setZonaEditada(null);
    avisar('Zona actualizada');
    cargar();
  };

  const alternarZona = async (z: ZonaEnvio) => {
    const { error } = await deliveryService.actualizarZona(z.id, { is_active: !z.is_active });
    if (error) return avisar(error, 'error');
    cargar();
  };

  const agregarRepartidor = async () => {
    const nombre = nuevoRepartidor.nombre.trim();
    if (!nombre) return avisar('Poné el nombre del repartidor', 'error');

    const { error } = await deliveryService.crearRepartidor({
      tenant_id: tenantId!,
      branch_id: branchId!,
      name: nombre,
      phone: nuevoRepartidor.telefono.trim() || null,
    });
    if (error) return avisar(error, 'error');

    setNuevoRepartidor({ nombre: '', telefono: '' });
    avisar('Repartidor agregado');
    cargar();
  };

  const guardarRepartidor = async () => {
    if (!repartidorEditado) return;
    const { error } = await deliveryService.actualizarRepartidor(repartidorEditado.id, {
      name: repartidorEditado.name.trim(),
      phone: repartidorEditado.phone?.trim() || null,
    });
    if (error) return avisar(error, 'error');

    setRepartidorEditado(null);
    avisar('Repartidor actualizado');
    cargar();
  };

  const alternarRepartidor = async (r: Repartidor) => {
    const { error } = await deliveryService.actualizarRepartidor(r.id, { is_active: !r.is_active });
    if (error) return avisar(error, 'error');
    cargar();
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    const { error } =
      borrando.tipo === 'zona'
        ? await deliveryService.borrarZona(borrando.id)
        : await deliveryService.borrarRepartidor(borrando.id);

    setBorrando(null);
    if (error) return avisar(error, 'error');
    avisar(borrando.tipo === 'zona' ? 'Zona eliminada' : 'Repartidor eliminado');
    cargar();
  };

  /** Un campo vacío vale 0: es lo que el local quiso decir al borrarlo. */
  const aNumero = (texto: string) => {
    const n = parseFloat(texto);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const configActual = (): (ConfigEnvio & { tenant_id: string }) | null =>
    config ? { ...config, km_base_price: aNumero(precioBase), km_price: aNumero(precioKm), tenant_id: tenantId! } : null;

  const guardarConfig = async () => {
    const payload = configActual();
    if (!payload) return;

    setGuardandoConfig(true);
    const { error } = await deliveryService.guardarConfig(payload);
    setGuardandoConfig(false);
    if (error) return avisar(error, 'error');
    avisar('Configuración guardada');
  };

  /**
   * El interruptor principal guarda solo, sin esperar al botón: es un sí o no
   * de todo el módulo y dejarlo a medias -apagado en pantalla pero encendido en
   * la base- es peor que un guardado de más.
   */
  const alternarDelivery = async () => {
    const payload = configActual();
    if (!payload) return;

    const actualizado = { ...payload, delivery_enabled: !payload.delivery_enabled };
    setConfig(actualizado);

    const { error } = await deliveryService.guardarConfig(actualizado);
    if (error) {
      setConfig(payload);
      return avisar(error, 'error');
    }
    avisar(actualizado.delivery_enabled ? 'Delivery activado' : 'Delivery desactivado');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary p-4 lg:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 hidden lg:block w-[900px] h-[900px] bg-warning/5 rounded-full blur-[180px] pointer-events-none" />

      <header className="mb-10 relative z-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-warning/10 rounded-2xl flex items-center justify-center border border-warning/20">
            <Bike size={24} className="text-warning" />
          </div>
          <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter leading-none">Delivery</h1>
        </div>
        <p className="text-text-muted text-sm font-medium ml-1">
          Zonas con precio, cobro por distancia y repartidores
        </p>
      </header>

      <div className="relative z-10 space-y-10 max-w-4xl">
        {/* ---------- INTERRUPTOR PRINCIPAL ---------- */}
        {config && (
          <button
            onClick={alternarDelivery}
            className={`w-full flex items-center justify-between gap-4 p-5 rounded-3xl border transition-all text-left ${
              config.delivery_enabled
                ? 'border-warning/30 bg-warning/10'
                : 'border-border-subtle bg-surface-elevated/40 hover:border-warning/30'
            }`}
          >
            <span>
              <span className="block font-black uppercase tracking-tight">
                Este local hace envíos a domicilio
              </span>
              <span className="block text-xs text-text-muted mt-1">
                {config.delivery_enabled
                  ? 'El POS ofrece el tipo de pedido Envío'
                  : 'Apagado: el POS no muestra la opción Envío y este módulo queda oculto del menú'}
              </span>
            </span>
            <span
              className={`w-12 h-7 rounded-full shrink-0 transition-colors relative ${
                config.delivery_enabled ? 'bg-warning' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                  config.delivery_enabled ? 'left-6' : 'left-1'
                }`}
              />
            </span>
          </button>
        )}

        {/* El resto sólo tiene sentido si el local reparte: configurar zonas y
            repartidores de un servicio apagado es ruido. */}
        {config?.delivery_enabled && (
        <>
        {/* ---------- ZONAS ---------- */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <MapPin size={20} className="text-text-muted" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Zonas de envío</h2>
          </div>
          <p className="text-text-secondary text-sm mb-5">
            Cada zona es un área con precio fijo. Poné el nombre que usen en el local:
            puede ser un barrio ("Villa Crespo") o una zona ("Centro", "Hasta 10 cuadras").
          </p>

          <Card variant="solid" padding="normal" className="border-white/5 bg-surface-elevated/40 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nombre de la zona"
                value={nuevaZona.nombre}
                onChange={(e) => setNuevaZona({ ...nuevaZona, nombre: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && agregarZona()}
                className="flex-1"
              />
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Precio"
                value={nuevaZona.precio}
                onChange={(e) => setNuevaZona({ ...nuevaZona, precio: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && agregarZona()}
                className="sm:w-40"
              />
              <Button leftIcon={<Plus size={18} />} onClick={agregarZona}>
                Agregar
              </Button>
            </div>
          </Card>

          {zonas.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">
              Todavía no hay zonas cargadas. Agregá la primera acá arriba.
            </p>
          ) : (
            <div className="space-y-3">
              {zonas.map((z) => (
                <Card
                  key={z.id}
                  variant="solid"
                  padding="normal"
                  className={`border-white/5 bg-surface-elevated/40 flex items-center gap-4 ${
                    z.is_active ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black tracking-tight truncate">{z.name}</p>
                    {!z.is_active && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mt-0.5">
                        Pausada
                      </p>
                    )}
                  </div>
                  <span className="text-xl font-black text-warning tracking-tighter shrink-0">
                    {plata(z.price)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => alternarZona(z)}
                      title={z.is_active ? 'Pausar zona' : 'Activar zona'}
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest px-3"
                    >
                      {z.is_active ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setZonaEditada(z)}
                      title="Editar"
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setBorrando({ tipo: 'zona', id: z.id, nombre: z.name })}
                      title="Eliminar"
                      className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ---------- COBRO POR KM ---------- */}
        {config && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <Ruler size={20} className="text-text-muted" />
              <h2 className="text-xl font-black uppercase tracking-tighter">Cobro por distancia</h2>
            </div>

            {/* El space-y va en un div adentro y no en className de la Card:
                Card envuelve los children en su propio div, así que la clase
                quedaba en el contenedor de afuera -con un solo hijo directo- y
                no separaba nada. Por eso Guardar quedaba pegado al bloque. */}
            <Card variant="solid" padding="large" className="border-white/5 bg-surface-elevated/40">
              <div className="space-y-6">
              <button
                onClick={() => setConfig({ ...config, km_enabled: !config.km_enabled })}
                className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all text-left ${
                  config.km_enabled
                    ? 'border-primary bg-primary/10'
                    : 'border-border-subtle bg-surface-base hover:border-primary/40'
                }`}
              >
                <span>
                  <span className="block font-black">Cobrar también por kilómetro</span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    Habilita en el POS la opción de calcular el envío según la distancia
                  </span>
                </span>
                <span
                  className={`w-12 h-7 rounded-full shrink-0 transition-colors relative ${
                    config.km_enabled ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                      config.km_enabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </span>
              </button>

              {config.km_enabled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                        Precio base
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={precioBase}
                        onChange={(e) => setPrecioBase(e.target.value)}
                      />
                      <p className="text-[10px] text-text-muted mt-1.5">Se cobra siempre, sin importar la distancia</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                        Precio por km
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={precioKm}
                        onChange={(e) => setPrecioKm(e.target.value)}
                      />
                      <p className="text-[10px] text-text-muted mt-1.5">Se multiplica por los km del envío</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-surface-base px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Ejemplo</p>
                    <p className="text-sm text-text-secondary">
                      Un envío de 5 km saldría{' '}
                      <span className="font-black text-primary">
                        {plata(calcularPrecioPorKm({ ...config, km_base_price: aNumero(precioBase), km_price: aNumero(precioKm) }, 5))}
                      </span>
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={guardarConfig} isLoading={guardandoConfig} leftIcon={<Save size={18} />}>
                  Guardar
                </Button>
              </div>
              </div>
            </Card>
          </section>
        )}

        {/* ---------- REPARTIDORES ---------- */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <User size={20} className="text-text-muted" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Repartidores</h2>
          </div>
          <p className="text-text-secondary text-sm mb-5">
            Se eligen desde Cocina cuando el pedido pasa a LISTO, para saber quién llevó cada envío.
          </p>

          <Card variant="solid" padding="normal" className="border-white/5 bg-surface-elevated/40 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nombre"
                value={nuevoRepartidor.nombre}
                onChange={(e) => setNuevoRepartidor({ ...nuevoRepartidor, nombre: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && agregarRepartidor()}
                className="flex-1"
              />
              <Input
                placeholder="Teléfono (opcional)"
                value={nuevoRepartidor.telefono}
                onChange={(e) => setNuevoRepartidor({ ...nuevoRepartidor, telefono: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && agregarRepartidor()}
                className="sm:w-52"
              />
              <Button leftIcon={<Plus size={18} />} onClick={agregarRepartidor}>
                Agregar
              </Button>
            </div>
          </Card>

          {repartidores.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">Todavía no hay repartidores cargados.</p>
          ) : (
            <div className="space-y-3">
              {repartidores.map((r) => (
                <Card
                  key={r.id}
                  variant="solid"
                  padding="normal"
                  className={`border-white/5 bg-surface-elevated/40 flex items-center gap-4 ${
                    r.is_active ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black tracking-tight truncate">{r.name}</p>
                    {r.phone && (
                      <p className="text-xs text-text-muted mt-0.5 inline-flex items-center gap-1.5">
                        <Phone size={12} /> {r.phone}
                      </p>
                    )}
                    {!r.is_active && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mt-0.5">
                        Inactivo
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => alternarRepartidor(r)}
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest px-3"
                    >
                      {r.is_active ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setRepartidorEditado(r)}
                      title="Editar"
                      className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-white/5 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setBorrando({ tipo: 'repartidor', id: r.id, nombre: r.name })}
                      title="Eliminar"
                      className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
        </>
        )}
      </div>

      <Modal isOpen={Boolean(zonaEditada)} onClose={() => setZonaEditada(null)} title="Editar zona" maxWidth="sm">
        {zonaEditada && (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Nombre
              </label>
              <Input
                value={zonaEditada.name}
                onChange={(e) => setZonaEditada({ ...zonaEditada, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Precio
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={zonaEditada.price}
                onChange={(e) => setZonaEditada({ ...zonaEditada, price: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setZonaEditada(null)}>
                Cancelar
              </Button>
              <Button onClick={guardarZona} leftIcon={<Save size={18} />}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(repartidorEditado)}
        onClose={() => setRepartidorEditado(null)}
        title="Editar repartidor"
        maxWidth="sm"
      >
        {repartidorEditado && (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Nombre
              </label>
              <Input
                value={repartidorEditado.name}
                onChange={(e) => setRepartidorEditado({ ...repartidorEditado, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
                Teléfono
              </label>
              <Input
                value={repartidorEditado.phone ?? ''}
                onChange={(e) => setRepartidorEditado({ ...repartidorEditado, phone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRepartidorEditado(null)}>
                Cancelar
              </Button>
              <Button onClick={guardarRepartidor} leftIcon={<Save size={18} />}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrado}
        title={borrando?.tipo === 'zona' ? 'Eliminar zona' : 'Eliminar repartidor'}
        message={
          borrando?.tipo === 'zona'
            ? `Se elimina "${borrando?.nombre}". Los pedidos viejos que la usaron no se tocan, pero pierden la referencia a la zona. Si sólo querés dejar de ofrecerla, usá Pausar.`
            : `Se elimina "${borrando?.nombre}". Los pedidos que ya llevó no se tocan, pero pierden la referencia. Si sólo dejó de trabajar, usá Pausar.`
        }
        confirmText="Eliminar"
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

export default DeliveryPage;
