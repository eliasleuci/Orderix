// Definitions for the Hamburguer Management System Domain

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type OrderType = 'MESA' | 'DELIVERY' | 'TAKEAWAY';

export interface Branch {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  branch_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  categories?: Category; // Nested from Supabase
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  unit_price?: number;
  price_at_sale?: number;
  modifiers?: Array<string | { label: string; price: number }>; // Puede ser string o objeto
  notes?: string;
  products?: Product; // Nested from Supabase
}

export interface Order {
  id: string;
  branch_id: string;
  user_id?: string;
  customer_name?: string;
  customer_address?: string;
  status: OrderStatus;
  order_type: OrderType;
  table_id?: string | null;
  tables?: any; // Nested table info
  total: number;
  payment_method: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;   // Timestamp cuando cocina presiona EMPEZAR
  ready_at?: string | null;     // Timestamp cuando cocina presiona LISTO
  order_items?: OrderItem[];
}

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}
