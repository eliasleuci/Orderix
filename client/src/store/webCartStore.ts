import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ItemCarritoWeb {
  /** Id de línea: el mismo producto con distinta nota son dos líneas. */
  lineaId: string;
  productId: string;
  nombre: string;
  precio: number;
  imagen: string | null;
  cantidad: number;
  notas?: string;
}

interface WebCartState {
  /** Local al que pertenece lo que hay en el carrito. */
  slug: string | null;
  items: ItemCarritoWeb[];
  /**
   * Se repite si el cliente reenvía el mismo pedido. Se limpia recién cuando el
   * pedido entró: volver atrás desde WhatsApp y reintentar tiene que llegar con
   * la misma clave, o el local recibe el pedido dos veces.
   */
  idempotencyKey: string | null;

  abrirLocal: (slug: string) => void;
  agregar: (item: Omit<ItemCarritoWeb, 'lineaId' | 'cantidad'>, cantidad?: number) => void;
  cambiarCantidad: (lineaId: string, cantidad: number) => void;
  quitar: (lineaId: string) => void;
  vaciar: () => void;
  clave: () => string;
  descartarClave: () => void;
  total: () => number;
  unidades: () => number;
}

const nuevaClave = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Carrito de la página pública.
 *
 * Aparte del carrito del POS a propósito: aquél persiste bajo una única clave
 * sin namespace, así que en el mismo dominio el del cajero y el del comensal se
 * pisarían. Y como acá el local se identifica por slug, entrar a otro local
 * tiene que empezar de cero y no heredar lo del anterior.
 */
export const useWebCartStore = create<WebCartState>()(
  persist(
    (set, get) => ({
      slug: null,
      items: [],
      idempotencyKey: null,

      abrirLocal: (slug) => {
        if (get().slug === slug) return;
        // Otro local: lo que había en el carrito no existe acá.
        set({ slug, items: [], idempotencyKey: null });
      },

      agregar: (item, cantidad = 1) => {
        const notas = item.notas?.trim() || undefined;
        const items = [...get().items];

        // Mismo producto y misma nota es la misma línea: suma cantidad en vez
        // de repetir el renglón.
        const existente = items.find((i) => i.productId === item.productId && i.notas === notas);
        if (existente) existente.cantidad += cantidad;
        else items.push({ ...item, notas, lineaId: nuevaClave(), cantidad });

        set({ items });
      },

      cambiarCantidad: (lineaId, cantidad) => {
        if (cantidad <= 0) return get().quitar(lineaId);
        set({ items: get().items.map((i) => (i.lineaId === lineaId ? { ...i, cantidad } : i)) });
      },

      quitar: (lineaId) => set({ items: get().items.filter((i) => i.lineaId !== lineaId) }),

      vaciar: () => set({ items: [], idempotencyKey: null }),

      clave: () => {
        const actual = get().idempotencyKey;
        if (actual) return actual;
        const clave = nuevaClave();
        set({ idempotencyKey: clave });
        return clave;
      },

      descartarClave: () => set({ idempotencyKey: null }),

      total: () => get().items.reduce((a, i) => a + i.precio * i.cantidad, 0),
      unidades: () => get().items.reduce((a, i) => a + i.cantidad, 0),
    }),
    { name: 'orderix-carrito-web' }
  )
);
