/* eslint-disable @typescript-eslint/no-empty-object-type */
// User types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'cashier';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Product types
export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  price: number;
  cost?: number;
  stock_quantity: number;
  low_stock_threshold: number;
  barcode?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Category types
export interface Category {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// Sale types
export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price?: number;
}

export interface Sale {
  id: number;
  sale_number: string;
  user_id: number;
  cashier_name?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'qr';
  payment_status: 'pending' | 'completed' | 'refunded';
  notes?: string;
  created_at: string;
  items?: SaleItem[];
  item_count?: number;
}

export interface CreateSaleRequest {
  items: SaleItem[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_method: 'cash' | 'card' | 'qr';
  discount_amount?: number;
  notes?: string;
}

// Payment types
export interface Payment {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripe_status(arg0: string, stripe_status: any): unknown;
  id: number;
  sale_id: number;
  payment_method: 'cash' | 'card' | 'qr';
  amount: number;
  currency: string;
  stripe_payment_id?: string;
  stripe_payment_intent_id?: string;
  payment_status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ProcessStripePaymentRequest {
  sale_id: number;
  amount: number;
  currency?: string;
  payment_method_id: string;
}

export interface ProcessCashPaymentRequest {
  sale_id: number;
  amount: number;
  received_amount: number;
  change_amount?: number;
}

export interface ProcessQRPaymentRequest {
  sale_id: number;
  amount: number;
  qr_transaction_id: string;
  provider?: string;
}

// Dashboard types
export interface DashboardStats {
  overview: {
    total_sales: number;
    total_revenue: number;
    average_sale: number;
    days_with_sales: number;
  };
  payment_breakdown: Array<{
    payment_method: string;
    count: number;
    total: number;
  }>;
  top_products: Array<{
    product_name: string;
    product_sku: string;
    total_quantity: number;
    total_revenue: number;
  }>;
  low_stock: Product[];
  recent_sales: Sale[];
  sales_trend: Array<{
    hour?: number;
    date?: string;
    count: number;
    revenue: number;
  }>;
  period: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Inventory types
export interface InventoryLog {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  user_id: number;
  user_name?: string;
  type: 'sale' | 'restock' | 'adjustment' | 'return';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id?: number;
  notes?: string;
  created_at: string;
}

export interface InventoryAdjustmentRequest {
  product_id: number;
  quantity_change: number;
  notes?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  channel?: string;
  timestamp?: string;
}

// Cart types
export interface CartItem extends SaleItem {
  // Extended from SaleItem
}

// Held/Parked Order
export interface HeldOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  discountAmount?: number;
  total: number;
}