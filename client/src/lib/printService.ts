const PRINT_SERVER_URL = 'http://localhost:3001';

interface PrintResponse {
  success?: boolean;
  error?: string;
  message?: string;
  tip?: string;
  status?: 'ready' | 'disconnected';
}

interface OrderData {
  ticketNumber: number;
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

  async testPrint(): Promise<PrintResponse> {
    return this.request('/print/test');
  }
}

export const printService = new PrintService();
