import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Product, CartItem } from '../types'
import { Config } from '../../constants/config'

interface CartState {
  items: CartItem[]
  discount: number
  taxRate: number

  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  applyDiscount: (percent: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set) => ({
      items: [],
      discount: 0,
      taxRate: Config.tax.rate,

      addItem: (product: Product) =>
        set((state) => {
          const existing = state.items.find(
            (item) => item.product.id === product.id
          )
          if (existing) {
            existing.quantity += 1
            existing.subtotal = existing.quantity * existing.product.price
          } else {
            state.items.push({
              product,
              quantity: 1,
              subtotal: product.price,
            })
          }
        }),

      removeItem: (productId: string) =>
        set((state) => {
          state.items = state.items.filter(
            (item) => item.product.id !== productId
          )
        }),

      updateQuantity: (productId: string, qty: number) =>
        set((state) => {
          if (qty <= 0) {
            state.items = state.items.filter(
              (item) => item.product.id !== productId
            )
            return
          }
          const item = state.items.find(
            (item) => item.product.id === productId
          )
          if (item) {
            item.quantity = qty
            item.subtotal = qty * item.product.price
          }
        }),

      applyDiscount: (percent: number) =>
        set((state) => {
          state.discount = Math.min(100, Math.max(0, percent))
        }),

      clearCart: () =>
        set((state) => {
          state.items = []
          state.discount = 0
        }),
    })),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

// Selectors
export const selectItemCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0)

export const selectSubtotal = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.subtotal, 0)

export const selectDiscountAmount = (state: CartState) => {
  const subtotal = selectSubtotal(state)
  return subtotal * (state.discount / 100)
}

export const selectTaxAmount = (state: CartState) => {
  const subtotal = selectSubtotal(state)
  const discountAmount = selectDiscountAmount(state)
  const afterDiscount = subtotal - discountAmount
  // Tax inclusive: extract VAT already included in price
  return afterDiscount * (state.taxRate / (1 + state.taxRate))
}

export const selectGrandTotal = (state: CartState) => {
  const subtotal = selectSubtotal(state)
  const discountAmount = selectDiscountAmount(state)
  // Tax inclusive: total is just subtotal minus discount (tax already in price)
  return subtotal - discountAmount
}
