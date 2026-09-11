// El servidor de impresión corre en la misma máquina que la caja. Aunque la
// app se sirva por HTTPS, los navegadores tratan localhost como origen seguro,
// así que la llamada no queda bloqueada por contenido mixto.
// Se puede apuntar a otra máquina de la red con VITE_PRINT_SERVER_URL.
const PRINT_SERVER_URL =
  import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:3001';

interface PrintResponse {
  success?: boolean;
  error?: string;
  message?: string;
  tip?: string;
  status?: 'ready' | 'disconnected';
  /** 'red' | 'windows' | 'simulacion' */
  modo?: string;
  /** Explica en criollo por qué no está lista, para poder diagnosticar. */
  detalle?: string;
}

interface OrderData {
  ticketNumber: number;
  /** Para el encabezado del ticket del cliente. */
  negocio?: string;
  sucursal?: string;
  customerName?: string;
  customerAddress?: string;
  orderType: string;
  table?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiers?: Array<{ label: string; price: number }>;
    notes?: string;
  }>;
  paymentMethod: string;
  total: number;
  time?: string;
}

class PrintService {
  private serverUrl: string;

  constructor() {
    this.serverUrl = PRINT_SERVER_URL;
  }

  private async request(endpoint: string, data?: OrderData): Promise<PrintResponse> {
    try {
      const response = await fetch(`${this.serverUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      return await response.json();
    } catch (err: any) {
      return {
        error: 'No se pudo conectar al servidor de impresión',
        tip: '¿Está corriendo el print-server? Ejecutá: cd print-server && npm start'
      };
    }
  }

  async checkStatus(): Promise<PrintResponse> {
    try {
      const response = await fetch(`${this.serverUrl}/status`);
      return await response.json();
    } catch (err: any) {
      return {
        error: 'No se pudo conectar al servidor de impresión',
        tip: '¿Está corriendo el print-server? Ejecutá: cd print-server && npm start'
      };
    }
  }

  async printKitchen(order: OrderData): Promise<PrintResponse> {
    const data = {
      ...order,
      time: order.time || new Date().toISOString()
    };
    return this.request('/print/kitchen', data);
  }

  async printCustomer(order: OrderData): Promise<PrintResponse> {
    const data = {
      ...order,
      time: order.time || new Date().toISOString()
    };
    return this.request('/print/customer', data);
  }

  async printBoth(order: OrderData): Promise<PrintResponse> {
    const data = {
      ...order,
      time: order.time || new Date().toISOString()
    };
    return this.request('/print/both', data);
  }

  /**
   * Impresión automática al confirmar un pedido.
   *
   * Qué tickets salen lo decide el servidor de impresión según su configuración,
   * no la app: así se cambia en el local sin tener que publicar una versión
   * nueva.
   *
   * Nunca lanza: la venta ya está registrada cuando se llama acá, y un problema
   * con la impresora no puede hacerle creer al cajero que el pedido no se tomó.
   */
  async printAuto(order: OrderData): Promise<PrintResponse> {
    try {
      return await this.request('/print/auto', {
        ...order,
        time: order.time || new Date().toISOString(),
      });
    } catch {
      return { error: 'No se pudo conectar al servidor de impresión' };
    }
  }

  async testPrint(): Promise<PrintResponse> {
    return this.request('/print/test');
  }
}

export const printService = new PrintService();
