import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Profile, Shop } from '../types'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useCartStore } from './cartStore'

interface User {
  id: string
  email: string
}

interface AuthState {
  user: User | null
  profile: Profile | null
  shop: Shop | null
  isLoading: boolean
  isInitialized: boolean

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  registerPushToken: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    user: null,
    profile: null,
    shop: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      set((state) => {
        state.isLoading = true
      })

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const user = { id: session.user.id, email: session.user.email! }

          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          // Fetch shop
          let shop = null
          if (profile?.shop_id) {
            const { data } = await supabase
              .from('shops')
              .select('*')
              .eq('id', profile.shop_id)
              .single()
            shop = data
          }

          set((state) => {
            state.user = user
            state.profile = profile as Profile
            state.shop = shop as Shop
          })

          // Register push token (best-effort, non-blocking)
          get().registerPushToken(user.id)
        }
      } catch (err) {
        // Session expired or invalid - user needs to sign in again
      } finally {
        set((state) => {
          state.isLoading = false
          state.isInitialized = true
        })
      }
    },

    signIn: async (email: string, password: string) => {
      set((state) => {
        state.isLoading = true
      })

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        const user = { id: data.user.id, email: data.user.email! }

        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileError) throw profileError

        // Fetch shop
        let shop = null
        if (profile?.shop_id) {
          const { data: shopData } = await supabase
            .from('shops')
            .select('*')
            .eq('id', profile.shop_id)
            .single()
          shop = shopData
        }

        // Guard: if the incoming shop differs from what was previously loaded
        // (e.g. a different account signed in without a proper sign-out), clear
        // any stale cart data before populating the new session.
        const previousShopId = get().shop?.id
        const incomingShopId = (shop as Shop | null)?.id ?? profile?.shop_id ?? null
        if (previousShopId && incomingShopId && previousShopId !== incomingShopId) {
          useCartStore.getState().clearCart()
        }

        set((state) => {
          state.user = user
          state.profile = profile as Profile
          state.shop = shop as Shop
          state.isLoading = false
        })

        // Register push token (best-effort, non-blocking)
        get().registerPushToken(user.id)
      } catch (err) {
        set((state) => {
          state.isLoading = false
        })
        throw err
      }
    },

    signOut: async () => {
      // Clear cart and resume order before signing out so nothing leaks to the next session/shop
      useCartStore.getState().clearResumeOrder()
      useCartStore.getState().clearCart()

      await supabase.auth.signOut()
      set((state) => {
        state.user = null
        state.profile = null
        state.shop = null
      })
    },

    registerPushToken: async (userId: string) => {
      try {
        // Push notifications require a development build — not available in Expo Go (SDK 53+)
        if (Platform.OS === 'web') return
        if (Constants.executionEnvironment === 'storeClient') return // Expo Go — skip silently

        const { status: existingStatus } = await Notifications.getPermissionsAsync()
        let finalStatus = existingStatus

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }

        if (finalStatus !== 'granted') return

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId:
            Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId,
        })
        const pushToken = tokenData.data

        await supabase
          .from('profiles')
          .update({ push_token: pushToken })
          .eq('id', userId)

        set((state) => {
          if (state.profile) {
            state.profile.push_token = pushToken
          }
        })
      } catch {
        // Non-critical: push notifications are best-effort
      }
    },
  }))
)
