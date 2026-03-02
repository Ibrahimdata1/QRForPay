import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Product, Category } from '../types'

interface ProductState {
  products: Product[]
  categories: Category[]
  selectedCategoryId: string | null
  searchQuery: string
  isLoading: boolean
  error: string | null

  fetchProducts: (shopId: string) => Promise<void>
  fetchCategories: (shopId: string) => Promise<void>
  setCategory: (categoryId: string | null) => void
  setSearch: (query: string) => void
  setProducts: (products: Product[]) => void
  deductStock: (productId: string, qty: number) => void
  saveProduct: (shopId: string, product: Partial<Product> & { name: string; price: number }) => Promise<void>
  deleteProduct: (productId: string) => Promise<void>
}

export const useProductStore = create<ProductState>()(
  immer((set, get) => ({
    products: [],
    categories: [],
    selectedCategoryId: null,
    searchQuery: '',
    isLoading: false,
    error: null,

    fetchProducts: async (shopId: string) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .order('name')

        if (error) throw error

        set((state) => {
          state.products = data as Product[]
          state.isLoading = false
        })
      } catch (err: any) {
        set((state) => {
          state.error = err.message || 'Failed to fetch products'
          state.isLoading = false
        })
      }
    },

    fetchCategories: async (shopId: string) => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('shop_id', shopId)
          .order('sort_order')

        if (error) throw error

        set((state) => {
          state.categories = data as Category[]
        })
      } catch (err: any) {
        set((state) => {
          state.error = err.message || 'Failed to fetch categories'
        })
      }
    },

    setCategory: (categoryId: string | null) =>
      set((state) => {
        state.selectedCategoryId = categoryId
      }),

    setSearch: (query: string) =>
      set((state) => {
        state.searchQuery = query
      }),

    setProducts: (products: Product[]) =>
      set((state) => {
        state.products = products
      }),

    deductStock: (productId: string, qty: number) =>
      set((state) => {
        const product = state.products.find((p) => p.id === productId)
        if (product) {
          product.stock = Math.max(0, product.stock - qty)
        }
      }),

    saveProduct: async (shopId, productData) => {
      const isEdit = !!productData.id
      if (isEdit) {
        const { error } = await supabase.from('products').update({
          name: productData.name,
          price: productData.price,
          category_id: productData.category_id ?? null,
          stock: productData.stock ?? 0,
        }).eq('id', productData.id!)
        if (error) throw error
        set((state) => {
          const idx = state.products.findIndex((p) => p.id === productData.id)
          if (idx !== -1) Object.assign(state.products[idx], productData)
        })
      } else {
        const { data, error } = await supabase.from('products').insert({
          shop_id: shopId,
          name: productData.name,
          price: productData.price,
          category_id: productData.category_id ?? null,
          stock: productData.stock ?? 0,
          is_active: true,
        }).select().single()
        if (error) throw error
        set((state) => { state.products.push(data as Product) })
      }
    },

    deleteProduct: async (productId) => {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', productId)
      if (error) throw error
      set((state) => { state.products = state.products.filter((p) => p.id !== productId) })
    },
  }))
)

// Selector for filtered products (category + search combined)
export const selectFilteredProducts = (state: ProductState): Product[] => {
  let result = state.products

  if (state.selectedCategoryId) {
    result = result.filter((p) => p.category_id === state.selectedCategoryId)
  }

  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase().trim()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
    )
  }

  return result
}
