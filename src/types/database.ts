// EasyShop POS - Database TypeScript Interfaces

export interface Shop {
  id: string;
  name: string;
  owner_id: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  shop_id: string | null;
  role: 'owner' | 'cashier';
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  shop_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
  barcode: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  shop_id: string;
  order_number: number;
  cashier_id: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  total_amount: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number;
  payment_method: 'cash' | 'qr' | 'card' | null;
  created_at: string;
  completed_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  order_id: string;
  method: 'cash' | 'qr' | 'card';
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'expired';
  qr_payload: string | null;
  transaction_ref: string | null;
  created_at: string;
  updated_at: string;
}

// Composite types for UI
export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  payment?: Payment;
}
