import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Ingredient, CartItem } from '../types'

interface IngredientState {
  ingredients: Ingredient[]
  isLoading: boolean

  fetchIngredients: (shopId: string) => Promise<void>
  saveIngredient: (shopId: string, data: Partial<Ingredient>) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
  adjustStock: (
    shopId: string,
    ingredientId: string,
    qty: number,
    type: 'stock_in' | 'adjustment' | 'waste',
    note?: string,
    userId?: string
  ) => Promise<void>
  deductForOrder: (shopId: string, orderId: string, items: CartItem[]) => Promise<void>
}

export const useIngredientStore = create<IngredientState>()(
  immer((set, _get) => ({
    ingredients: [],
    isLoading: false,

    fetchIngredients: async (shopId: string) => {
      set((state) => {
        state.isLoading = true
      })
      try {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .order('name')

        if (error) throw error

        set((state) => {
          state.ingredients = (data ?? []) as Ingredient[]
          state.isLoading = false
        })
      } catch {
        set((state) => {
          state.isLoading = false
        })
      }
    },

    saveIngredient: async (shopId: string, data: Partial<Ingredient>) => {
      const isEdit = !!data.id

      if (isEdit) {
        const { error } = await supabase
          .from('ingredients')
          .update({
            name: data.name,
            unit: data.unit,
            current_stock: data.current_stock,
            min_threshold: data.min_threshold,
            cost_per_unit: data.cost_per_unit,
            expiry_date: data.expiry_date ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id!)

        if (error) throw error

        set((state) => {
          const idx = state.ingredients.findIndex((i) => i.id === data.id)
          if (idx !== -1) Object.assign(state.ingredients[idx], data)
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('ingredients')
          .insert({
            shop_id: shopId,
            name: data.name,
            unit: data.unit,
            current_stock: data.current_stock ?? 0,
            min_threshold: data.min_threshold ?? 0,
            cost_per_unit: data.cost_per_unit ?? 0,
            expiry_date: data.expiry_date ?? null,
            is_active: true,
          })
          .select()
          .single()

        if (error) throw error

        set((state) => {
          state.ingredients.push(inserted as Ingredient)
        })
      }
    },

    deleteIngredient: async (id: string) => {
      const { error } = await supabase
        .from('ingredients')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      set((state) => {
        state.ingredients = state.ingredients.filter((i) => i.id !== id)
      })
    },

    adjustStock: async (
      shopId: string,
      ingredientId: string,
      qty: number,
      type: 'stock_in' | 'adjustment' | 'waste',
      note?: string,
      userId?: string
    ) => {
      // For stock_in: positive delta. For waste/adjustment: caller passes signed qty.
      const delta = type === 'stock_in' ? Math.abs(qty) : qty

      // Fetch current stock first, then apply delta (Supabase JS v2 doesn't support
      // column arithmetic expressions in .update(), so we compute in application layer).
      const { data: current, error: fetchError } = await supabase
        .from('ingredients')
        .select('current_stock')
        .eq('id', ingredientId)
        .single()

      if (fetchError) throw fetchError

      const newStock = Math.max(0, Number(current.current_stock) + delta)

      const { error: stockError } = await supabase
        .from('ingredients')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', ingredientId)

      if (stockError) throw stockError

      // Insert transaction log
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert({
          shop_id: shopId,
          ingredient_id: ingredientId,
          transaction_type: type,
          quantity: delta,
          note: note ?? null,
          created_by: userId ?? null,
        })

      if (txError) throw txError

      // Update local state
      set((state) => {
        const ingredient = state.ingredients.find((i) => i.id === ingredientId)
        if (ingredient) {
          ingredient.current_stock = newStock
        }
      })
    },

    deductForOrder: async (shopId: string, orderId: string, items: CartItem[]) => {
      if (items.length === 0) return

      // Build a map of ingredientId -> totalDelta across all cart items
      const deltaMap: Record<string, number> = {}

      for (const cartItem of items) {
        const productId = cartItem.product.id

        // Fetch recipes for this product
        const { data: recipes, error: recipeError } = await supabase
          .from('recipes')
          .select('ingredient_id, quantity_per_unit')
          .eq('product_id', productId)

        if (recipeError) throw recipeError
        if (!recipes || recipes.length === 0) continue

        for (const recipe of recipes) {
          const totalUsage = recipe.quantity_per_unit * cartItem.quantity
          if (deltaMap[recipe.ingredient_id]) {
            deltaMap[recipe.ingredient_id] += totalUsage
          } else {
            deltaMap[recipe.ingredient_id] = totalUsage
          }
        }
      }

      const ingredientIds = Object.keys(deltaMap)
      if (ingredientIds.length === 0) return

      // Fetch current stock for all affected ingredients
      const { data: currentStocks, error: fetchError } = await supabase
        .from('ingredients')
        .select('id, current_stock')
        .in('id', ingredientIds)

      if (fetchError) throw fetchError

      // Prepare updates and transaction rows
      const transactionRows: Array<{
        shop_id: string
        ingredient_id: string
        transaction_type: string
        quantity: number
        reference_id: string
        note: string
      }> = []

      for (const row of currentStocks ?? []) {
        const delta = deltaMap[row.id]
        if (!delta) continue

        const newStock = Math.max(0, Number(row.current_stock) - delta)

        const { error: updateError } = await supabase
          .from('ingredients')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', row.id)

        if (updateError) throw updateError

        transactionRows.push({
          shop_id: shopId,
          ingredient_id: row.id,
          transaction_type: 'auto_deduct',
          quantity: -delta,
          reference_id: orderId,
          note: 'ตัดสต็อกอัตโนมัติจากการขาย',
        })

        // Update local state
        set((state) => {
          const ingredient = state.ingredients.find((i) => i.id === row.id)
          if (ingredient) {
            ingredient.current_stock = newStock
          }
        })
      }

      if (transactionRows.length > 0) {
        const { error: txError } = await supabase
          .from('stock_transactions')
          .insert(transactionRows)

        if (txError) throw txError
      }
    },
  }))
)
