import { Prisma } from '@prisma/client';
import { WebshopRepository } from './repository';
import { AppError } from '../../common/exceptions/AppError';
import { getContext } from '../../common/utils/context';

const webshopRepository = new WebshopRepository();

const aNumero = (v: unknown) => Number(v ?? 0);
const redondear = (n: number) => Math.round(n * 100) / 100;

export interface ItemDelCarrito {
  productId: string;
  quantity: number;
  notes?: string | null;
  /** Ids de las opciones de extras que el cliente marcó, si el producto tiene. */
  modifierOptionIds?: string[];
}

export interface PedidoEntrante {
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  orderType: 'DELIVERY' | 'TAKEAWAY';
  paymentMethod: 'CASH' | 'TRANSFER';
  deliveryZoneId?: string | null;
  notes?: string | null;
  items: ItemDelCarrito[];
}

const serializarPedido = (p: any) => ({
  id: p.id,
  codigo: Number(p.code),
  estado: p.status,
  cliente: p.customerName,
  telefono: p.customerPhone,
  direccion: p.customerAddress,
  ubicacion: p.customerLat != null && p.customerLng != null ? { lat: p.customerLat, lng: p.customerLng } : null,
  tipo: p.orderType,
  formaDePago: p.paymentMethod,
  zona: p.deliveryZone?.name ?? null,
  notas: p.notes,
  totalProductos: aNumero(p.itemsTotal),
  costoEnvio: aNumero(p.deliveryFee),
  total: redondear(aNumero(p.itemsTotal) + aNumero(p.deliveryFee)),
  creadoEn: p.createdAt,
  confirmadoEn: p.confirmedAt,
  motivoRechazo: p.rejectedReason,
  orderId: p.orderId,
  items: (p.items ?? []).map((i: any) => ({
    id: i.id,
    nombre: i.productName,
    cantidad: i.quantity,
    precioUnitario: aNumero(i.unitPrice),
    subtotal: redondear(aNumero(i.unitPrice) * i.quantity),
    notas: i.notes,
    extras: (i.modifiers ?? []) as { label: string; price: number }[],
  })),
});

export class WebshopService {
  /**
   * Resuelve el local por slug y lo deja en el contexto.
   *
   * Es la línea más importante del módulo: la extensión de Prisma filtra por
   * tenant leyendo el contexto, y si no hay ninguno NO filtra nada. Olvidarse
   * de esto no da error, da los datos de todos los locales.
   */
  private async resolverSucursal(slug: string, branchId?: string) {
    const tenant = await webshopRepository.findTenantBySlug(slug);
    if (!tenant) throw new AppError('Local no encontrado', 404);

    const store = getContext();
    if (store) store.tenantId = tenant.id;

    const sucursales = await webshopRepository.findActiveBranches(tenant.id);
    if (sucursales.length === 0) throw new AppError('El local no tiene sucursales activas', 404);

    // Una sucursal pedida que no sea de este local se ignora y se cae en la
    // primera, para no filtrar si ese id existe o no.
    const sucursal = sucursales.find((b) => b.id === branchId) ?? sucursales[0]!;
    return { tenant, sucursales, sucursal };
  }

  /** Lo que necesita la página pública para mostrarse y cotizar. */
  async getVidriera(slug: string, branchId?: string, modo: 'carta' | 'pedidos' = 'pedidos') {
    const { tenant, sucursales, sucursal } = await this.resolverSucursal(slug, branchId);

    const [config, envio, zonas, productos, versiones, versionesCategoria] = await Promise.all([
      webshopRepository.findWebSettings(sucursal.id),
      webshopRepository.findDeliverySettings(sucursal.id),
      webshopRepository.findZonas(sucursal.id),
      webshopRepository.findMenuProducts(sucursal.id),
      webshopRepository.findImageVersions(sucursal.id),
      webshopRepository.findCategoryImageVersions(tenant.id),
    ]);

    const versionPorProducto = new Map(versiones.map((v) => [v.id, v.v]));
    const versionPorCategoria = new Map(versionesCategoria.map((v) => [v.id, v.v]));

    const urlDeImagen = (tipo: 'producto' | 'categoria', id: string, version: string) =>
      `/webshop/publico/${encodeURIComponent(slug)}/imagen/${tipo}/${id}` +
      `?sucursal=${encodeURIComponent(sucursal.id)}&v=${version}`;

    const categorias = new Map<string, { id: string; nombre: string; imagen: string | null; orden: number; productos: unknown[] }>();
    const sinCategoria: unknown[] = [];

    for (const p of productos) {
      // Un ingrediente dado de baja sigue atado a recetas viejas: mostrarlo
      // diría que el plato lleva algo que el local ya no usa.
      const ingredientes = [
        ...new Set(
          p.recipe
            .filter((r) => r.ingredient?.is_active)
            .map((r) => r.ingredient!.name.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'));

      const producto = {
        id: p.id,
        nombre: p.name,
        descripcion: p.description,
        precio: aNumero(p.price),
        // Una ruta del propio backend, no la imagen: el navegador la pide
        // aparte, en paralelo y una sola vez (después queda en su caché).
        imagen: versionPorProducto.has(p.id)
          ? urlDeImagen('producto', p.id, versionPorProducto.get(p.id)!)
          : null,
        ingredientes,
        // Sólo lo que hace falta para elegir y sumar: nada de ids de tenant ni
        // de fechas internas.
        grupos: p.modifierGroups.map((g) => ({
          id: g.id,
          nombre: g.name,
          minimo: g.minSelect,
          maximo: g.maxSelect,
          opciones: g.options.map((o) => ({ id: o.id, nombre: o.name, precio: aNumero(o.price) })),
        })),
      };

      // Una categoría puede estar activa para pedidos online y sin embargo no
      // mostrarse en la carta física del salón (show_in_carta): en ese modo el
      // producto directamente no se muestra, no cae en "Otros".
      if (p.category && p.category.isActive !== false && modo === 'carta' && !p.category.showInCarta) {
        continue;
      }

      // Pausada: no se ofrece en la vidriera, pero sigue existiendo para no
      // tener que reasignar sus productos a otra categoría.
      if (!p.category || p.category.isActive === false) {
        sinCategoria.push(producto);
        continue;
      }
      const actual = categorias.get(p.category.id);
      if (actual) actual.productos.push(producto);
      else
        categorias.set(p.category.id, {
          id: p.category.id,
          nombre: p.category.name,
          imagen: versionPorCategoria.has(p.category.id)
            ? urlDeImagen('categoria', p.category.id, versionPorCategoria.get(p.category.id)!)
            : null,
          orden: p.category.displayOrder,
          productos: [producto],
        });
    }
    if (sinCategoria.length > 0) {
      categorias.set('sin-categoria', {
        id: 'sin-categoria',
        nombre: 'Otros',
        imagen: null,
        // Al final siempre: es el cajón de lo que no tiene categoría propia.
        orden: Number.MAX_SAFE_INTEGER,
        productos: sinCategoria,
      });
    }

    // El envío sólo se ofrece si el local reparte Y tiene zonas cargadas: sin
    // zonas no hay forma de cotizarlo y el cliente pediría a ciegas.
    const haceEnvios = envio?.deliveryEnabled !== false && zonas.length > 0;

    return {
      local: { nombre: tenant.name, slug: tenant.slug },
      sucursalActual: {
        id: sucursal.id,
        nombre: sucursal.name,
        direccion: sucursal.location,
        telefono: sucursal.phone,
      },
      sucursales: sucursales.map((b) => ({ id: b.id, nombre: b.name })),
      // Sin fila de configuración el canal está apagado: la página se comporta
      // como la carta de sólo lectura de siempre.
      pedidos: {
        habilitado: Boolean(config?.enabled) && !config?.paused,
        pausado: Boolean(config?.paused),
        whatsapp: config?.whatsappPhone ?? null,
        minimo: aNumero(config?.minOrder),
        aceptaEfectivo: config?.acceptsCash !== false,
        aceptaTransferencia: Boolean(config?.acceptsTransfer),
        datosTransferencia: config?.acceptsTransfer ? config?.transferInfo ?? null : null,
        permiteRetiro: config?.takeawayEnabled !== false,
        permiteEnvio: haceEnvios,
        minutosPreparacion: config?.prepMinutes ?? null,
      },
      zonas: haceEnvios ? zonas.map((z) => ({ id: z.id, nombre: z.name, precio: aNumero(z.price) })) : [],
      categorias: [...categorias.values()].sort((a, b) => a.orden - b.orden),
    };
  }

  /**
   * La foto de un producto o de una categoría, decodificada. Se guardan como
   * data URL en base64 dentro de la propia fila; servirlas por acá en vez de
   * embeberlas en el JSON de la carta es lo que la volvió liviana.
   */
  async getImagen(
    slug: string,
    branchId: string | undefined,
    tipo: 'producto' | 'categoria',
    id: string
  ): Promise<{ redirigirA: string } | { contentType: string; contenido: Buffer }> {
    // La carta pública pide una imagen por cada producto y categoría (ver
    // comentario más abajo), así que acá se evita a propósito el resolverSucursal
    // completo (tenant + lista de sucursales en dos consultas): con la carta ya
    // resuelta antes, alcanza con un solo viaje a la base para confirmar a qué
    // sucursal de este local corresponde la imagen.
    const sucursalId = await webshopRepository.findBranchIdParaImagen(slug, branchId);
    if (!sucursalId) throw new AppError('Local no encontrado', 404);

    const guardada =
      tipo === 'producto'
        ? (await webshopRepository.findProductImage(sucursalId, id))?.image
        : (await webshopRepository.findCategoryImage(id))?.imageUrl;

    if (!guardada) throw new AppError('Imagen no encontrada', 404);

    // Si algún día las fotos pasan a un bucket, el valor guardado va a ser una
    // URL común y no hay nada que decodificar: se redirige y listo.
    if (/^https?:\/\//i.test(guardada)) {
      return { redirigirA: guardada };
    }

    const match = /^data:([^;,]+);base64,(.*)$/s.exec(guardada);
    if (!match) throw new AppError('Imagen no encontrada', 404);

    return {
      contentType: match[1]!,
      contenido: Buffer.from(match[2]!, 'base64'),
    };
  }

  /**
   * Da de alta el pedido. Todo lo que define plata se recalcula acá contra la
   * base: el navegador manda qué y cuánto, nunca a qué precio.
   */
  async crearPedido(slug: string, branchId: string | undefined, entrada: PedidoEntrante, ip?: string) {
    const { tenant, sucursal } = await this.resolverSucursal(slug, branchId);

    // Reenvío: volver atrás desde WhatsApp y reintentar es lo normal. Se
    // devuelve el pedido que ya existe en vez de duplicarlo.
    const yaExiste = await webshopRepository.findPorIdempotencia(sucursal.id, entrada.idempotencyKey);
    if (yaExiste) return { pedido: serializarPedido(yaExiste), repetido: true };

    const config = await webshopRepository.findWebSettings(sucursal.id);
    if (!config?.enabled) throw new AppError('Este local no está tomando pedidos online', 409);
    if (config.paused) throw new AppError('El local no está tomando pedidos en este momento', 409);

    if (entrada.orderType === 'TAKEAWAY' && !config.takeawayEnabled) {
      throw new AppError('Este local no permite retirar por el local', 409);
    }
    if (entrada.paymentMethod === 'CASH' && !config.acceptsCash) {
      throw new AppError('Este local no acepta efectivo', 409);
    }
    if (entrada.paymentMethod === 'TRANSFER' && !config.acceptsTransfer) {
      throw new AppError('Este local no acepta transferencia', 409);
    }

    // Precios de la base, no los del carrito.
    const ids = [...new Set(entrada.items.map((i) => i.productId))];
    const productos = await webshopRepository.findPreciosParaCotizar(sucursal.id, ids);
    const porId = new Map(productos.map((p) => [p.id, p]));

    const faltantes = ids.filter((id) => !porId.has(id));
    if (faltantes.length > 0) {
      throw new AppError('Algún producto ya no está disponible. Actualizá la página.', 409);
    }

    let itemsTotal = 0;
    const items = entrada.items.map((i) => {
      const producto = porId.get(i.productId)!;
      const precioBase = aNumero(producto.price);

      // Los extras se precian y validan contra la base, igual que el producto:
      // el navegador dice qué se marcó, nunca a qué precio ni si correspondía.
      const idsElegidos = new Set(i.modifierOptionIds ?? []);
      const modifiers: { label: string; price: number }[] = [];
      let sumaExtras = 0;

      for (const grupo of producto.modifierGroups) {
        const elegidasDelGrupo = grupo.options.filter((o) => idsElegidos.has(o.id));

        if (elegidasDelGrupo.length < grupo.minSelect) {
          throw new AppError(`Elegí una opción de "${grupo.name}" en ${producto.name}`, 400);
        }
        if (grupo.maxSelect != null && elegidasDelGrupo.length > grupo.maxSelect) {
          throw new AppError(`En "${grupo.name}" de ${producto.name} podés elegir hasta ${grupo.maxSelect}`, 400);
        }

        for (const o of elegidasDelGrupo) {
          const precio = aNumero(o.price);
          modifiers.push({ label: o.name, price: precio });
          sumaExtras += precio;
        }
      }

      // Un id que no pertenece a ningún grupo de este producto (de otro
      // producto, o inventado) no rompe el pedido: simplemente no se cobra ni
      // se agrega, porque no hay de dónde sacarle un precio confiable.

      const precioUnitario = redondear(precioBase + sumaExtras);
      itemsTotal += precioUnitario * i.quantity;

      return {
        tenantId: tenant.id,
        productId: producto.id,
        // Congelado: el local tiene que ver qué aceptó el cliente, aunque
        // después le cambien el precio o el nombre al producto.
        productName: producto.name,
        unitPrice: precioUnitario,
        quantity: i.quantity,
        notes: i.notes?.trim() || null,
        // DbNull y no null: en una columna Json, Prisma escribe el `null` de
        // JSON, que es un escalar y no un vacío. La función que confirma el
        // pedido recorre este campo como lista y se cortaba contra ese escalar.
        modifiers: modifiers.length > 0 ? modifiers : Prisma.DbNull,
      };
    });
    itemsTotal = redondear(itemsTotal);

    if (itemsTotal < aNumero(config.minOrder)) {
      throw new AppError(`El pedido mínimo es $${aNumero(config.minOrder)}`, 409);
    }

    // El envío también sale de la base: el precio de la zona lo pone el local.
    let deliveryFee = 0;
    let zonaId: string | null = null;
    if (entrada.orderType === 'DELIVERY') {
      if (!entrada.deliveryZoneId) throw new AppError('Elegí la zona de envío', 400);

      const zona = await webshopRepository.findZonaParaCotizar(sucursal.id, entrada.deliveryZoneId);
      if (!zona) throw new AppError('Esa zona de envío ya no está disponible', 409);

      zonaId = zona.id;
      deliveryFee = aNumero(zona.price);
    }

    try {
      const pedido = await webshopRepository.crearPedido(
        {
          tenantId: tenant.id,
          branchId: sucursal.id,
          customerName: entrada.customerName.trim(),
          customerPhone: entrada.customerPhone,
          customerAddress: entrada.customerAddress?.trim() || null,
          customerLat: entrada.customerLat ?? null,
          customerLng: entrada.customerLng ?? null,
          orderType: entrada.orderType,
          paymentMethod: entrada.paymentMethod,
          notes: entrada.notes?.trim() || null,
          itemsTotal,
          deliveryFee,
          deliveryZoneId: zonaId,
          idempotencyKey: entrada.idempotencyKey,
          clientIp: ip ?? null,
        },
        items
      );

      return { pedido: serializarPedido(pedido), repetido: false };
    } catch (e: any) {
      // 23505: chocó con el índice de un pedido por teléfono por minuto.
      // 54000: lo frenó el trigger de avalancha.
      if (e?.code === 'P2002' || e?.meta?.code === '23505' || String(e?.message).includes('23505')) {
        const repetido = await webshopRepository.findPorIdempotencia(sucursal.id, entrada.idempotencyKey);
        if (repetido) return { pedido: serializarPedido(repetido), repetido: true };
        throw new AppError('Esperá un minuto antes de mandar otro pedido', 429);
      }
      if (String(e?.message).includes('54000') || String(e?.meta?.code) === '54000') {
        throw new AppError('Hay demasiados pedidos sin confirmar. Probá en un rato.', 429);
      }
      throw e;
    }
  }

  private exigirSucursal(branchId?: string | null): string {
    if (!branchId) throw new AppError('El usuario no tiene una sucursal asignada', 400);
    return branchId;
  }

  async getBandeja(branchId: string | null | undefined, incluirCerrados = false) {
    const sucursal = this.exigirSucursal(branchId);
    const estados = incluirCerrados
      ? ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED']
      : ['PENDING'];

    const pedidos = await webshopRepository.findPedidos(sucursal, estados, 60);
    return pedidos.map(serializarPedido);
  }

  async confirmar(
    branchId: string | null | undefined,
    userId: string,
    id: string,
    aceptarCambioDePrecio: boolean
  ) {
    const sucursal = this.exigirSucursal(branchId);

    // Se chequea la sucursal acá porque la función de la base no la mira: entra
    // por el servidor, que es quien sabe de qué local es el que está pidiendo.
    const pedido = await webshopRepository.findPedido(id, sucursal);
    if (!pedido) throw new AppError('No se encontró ese pedido', 404);

    const res = await webshopRepository.confirmar(id, userId, aceptarCambioDePrecio);

    // La función devuelve el problema en el JSON en vez de levantar error, para
    // poder distinguir "no se pudo" de "hay que preguntarle a una persona".
    if (res?.status === 'precio_cambiado') {
      return { estado: 'precio_cambiado' as const, cambios: res.cambios, totalHoy: aNumero(res.total_hoy) };
    }
    if (res?.status === 'productos_no_disponibles') {
      return { estado: 'productos_no_disponibles' as const, faltantes: res.faltantes };
    }
    if (res?.status !== 'success') {
      throw new AppError(res?.message ?? 'No se pudo confirmar el pedido', 409);
    }

    return {
      estado: 'confirmado' as const,
      orderId: res.order_id,
      total: aNumero(res.total),
      advertencias: res.advertencias ?? [],
    };
  }

  async rechazar(branchId: string | null | undefined, id: string, motivo?: string | null) {
    const sucursal = this.exigirSucursal(branchId);

    const filas = await webshopRepository.rechazar(id, sucursal, motivo?.trim() || null);
    if (filas === 0) throw new AppError('No se encontró ese pedido pendiente', 404);
  }
}
