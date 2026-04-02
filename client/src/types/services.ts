import { Category, Product, Order, OrderStatus, ServiceResponse, Branch } from './domain';
import { User, Session } from '@supabase/supabase-js';

export interface OrderItemModifier {
  label: string;
  price: number;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  price_at_sale: number;
  modifiers?: OrderItemModifier[];
  notes?: string;
  products?: Product; // Nested from Supabase
}

export interface CreateOrderParams {
  branchId: string;
  userId?: string;
  customerName?: string;
  customerAddress?: string;
  orderType?: string; // MESA | DELIVERY | TAKEAWAY
  tableId?: string | null;
  items: { product_id: string; quantity: number; price: number; modifiers?: OrderItemModifier[]; notes?: string }[];
  total: number;
  paymentMethod: string;
}

export interface IAuthService {
  signIn(email: string, password: string): Promise<ServiceResponse<{ user: User; session: Session }>>;
  signOut(): Promise<ServiceResponse<void>>;
  getBranches(): Promise<ServiceResponse<Branch[]>>;
}

export interface IProductService {
  getBranchProducts(branchId: string, includeInactive?: boolean): Promise<ServiceResponse<Product[]>>;
  getCategories(): Promise<ServiceResponse<Category[]>>;
  createProduct(product: Partial<Product>): Promise<ServiceResponse<Product>>;
  updateProduct(id: string, updates: Partial<Product>): Promise<ServiceResponse<Product>>;
  deleteProduct(id: string): Promise<ServiceResponse<boolean>>;
}

export interface IOrderService {
  createOrder(params: CreateOrderParams): Promise<ServiceResponse<{ order_id: string; status: string; message: string }>>;
  getBranchOrders(branchId: string): Promise<ServiceResponse<Order[]>>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<ServiceResponse<Order>>;
}
