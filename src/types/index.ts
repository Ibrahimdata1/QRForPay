export interface Shop {
  id: string
  name: string
  promptpay_id: string
  tax_rate: number
  address?: string
  phone?: string
  logo_url?: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'cashier'
  shop_id: string
  avatar_url?: string
  push_token?: string | null
  created_at: string
}

export interface Category {
  id: string
  shop_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  category_id: string
  name: string
  price: number
  image_url?: string
  stock: number
  sku?: string
  is_active: boolean
  created_at: string
}

export interface Order {
  id: string
  shop_id: string
  order_number: number
  cashier_id: string | null
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  total_amount: number | null
  subtotal: number | null
  tax_amount: number | null
  discount_amount: number
  payment_method: 'cash' | 'qr' | 'card' | null
  created_at: string
  completed_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Payment {
  id: string
  order_id: string
  method: 'cash' | 'qr' | 'card'
  amount: number
  status: 'pending' | 'success' | 'failed' | 'expired'
  qr_payload: string | null
  transaction_ref: string | null
  confirmation_type: 'manual' | 'auto' | null
  confirmed_by: string | null
  created_at: string
  updated_at: string
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
  payment?: Payment
  confirmedByProfile?: { full_name: string }
}

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
}

export interface Ingredient {
  id: string
  shop_id: string
  name: string
  unit: string
  current_stock: number
  min_threshold: number
  cost_per_unit: number
  expiry_date?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Recipe {
  id: string
  product_id: string
  ingredient_id: string
  quantity_per_unit: number
}

export interface StockTransaction {
  id: string
  shop_id: string
  ingredient_id: string
  transaction_type: 'stock_in' | 'adjustment' | 'waste' | 'auto_deduct'
  quantity: number
  reference_id?: string | null
  note?: string | null
  created_by?: string | null
  created_at: string
}
