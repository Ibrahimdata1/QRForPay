import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Profile, Shop } from '../types'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useCartStore } from './cartStore'
import { useProductStore } from './productStore'

interface User {
  id: string
  email: string
}

export interface TeamMember {
  id: string
  email?: string
  full_name?: string
  role: 'super_admin' | 'owner' | 'cashier' | null
  avatar_url?: string
}

export interface PendingUser {
  id: string
  email?: string
  full_name?: string
  avatar_url?: string
  created_at: string
  pending_shop_name?: string | null
  pending_promptpay?: string | null
}

interface AuthState {
  user: User | null
  profile: Profile | null
  shop: Shop | null
  team: TeamMember[]
  pendingUsers: PendingUser[]
  isLoading: boolean
  isInitialized: boolean

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  registerPushToken: (userId: string) => Promise<void>
  // Owner actions
  fetchTeam: () => Promise<void>
  createCashier: (fullName: string, email: string, password: string) => Promise<void>
  removeTeamMember: (profileId: string) => Promise<void>
  // Pending owner: self-registration step
  submitOwnerInfo: (shopName: string, promptpayId: string) => Promise<void>
  // Super admin actions
  fetchPendingUsers: () => Promise<void>
  approveOwner: (userId: string, shopName: string, promptpayId: string) => Promise<void>
}

async function loadProfileAndShop(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  let shop = null
  if (profile?.shop_id) {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('id', profile.shop_id)
      .single()
    shop = data
  }

  return { profile: profile as Profile | null, shop: shop as Shop | null }
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    user: null,
    profile: null,
    shop: null,
    team: [],
    pendingUsers: [],
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
          const { profile, shop } = await loadProfileAndShop(user.id)

          set((state) => {
            state.user = user
            state.profile = profile
            state.shop = shop
          })

          // Register push token only for approved users
          if (profile?.role) {
            get().registerPushToken(user.id)
          }
        }
      } catch {
        // Session expired or invalid — user needs to sign in again
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
        const { profile, shop } = await loadProfileAndShop(user.id)

        // Guard: clear stale cart when shop changes
        const previousShopId = get().shop?.id
        const incomingShopId = (shop as Shop | null)?.id ?? profile?.shop_id ?? null
        if (previousShopId && incomingShopId && previousShopId !== incomingShopId) {
          useCartStore.getState().clearCart()
        }

        set((state) => {
          state.user = user
          state.profile = profile
          state.shop = shop
          state.isLoading = false
        })

        if (profile?.role) {
          get().registerPushToken(user.id)
        }
      } catch (err) {
        set((state) => {
          state.isLoading = false
        })
        throw err
      }
    },

    signInWithGoogle: async () => {
      set((state) => {
        state.isLoading = true
      })

      try {
        if (Platform.OS === 'web') {
          // Web: full-page redirect — Supabase handles session via detectSessionInUrl
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: (window as any).location.origin,
            },
          })
          if (error) throw error
          // Page will redirect; isLoading stays true until redirect completes
          return
        }

        // Native: open browser + exchange code manually
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const WebBrowser = require('expo-web-browser')

        const redirectUrl = 'qrforpay://auth/callback'
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        })

        if (error) throw error
        if (!data.url) throw new Error('ไม่ได้รับ OAuth URL จาก Supabase')

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

        if (result.type === 'success' && result.url) {
          // Extract auth code from callback URL
          // Custom schemes (qrforpay://) may not parse with new URL(), so extract manually
          const callbackUrl = result.url
          // Try query params (?code=xxx) and fragment (#code=xxx)
          const queryStr = callbackUrl.split('?')[1] || ''
          const fragmentStr = callbackUrl.split('#')[1] || ''
          const params = new URLSearchParams(queryStr || fragmentStr)
          const code = params.get('code')

          if (code) {
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
            if (sessionError) throw sessionError
          } else {
            // Fragment may contain access_token (implicit flow) — let Supabase handle it
            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')
            if (accessToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              })
              if (sessionError) throw sessionError
            } else {
              throw new Error('Google login callback ไม่มี code หรือ token')
            }
          }
          // Re-initialize to load profile/shop
          await get().initialize()
        } else {
          set((state) => {
            state.isLoading = false
          })
        }
      } catch (err) {
        set((state) => {
          state.isLoading = false
        })
        throw err
      }
    },

    signOut: async () => {
      useCartStore.getState().clearResumeOrder()
      useCartStore.getState().clearCart()
      useProductStore.setState({ products: [], categories: [] })
      set((state) => {
        state.user = null
        state.profile = null
        state.shop = null
        state.team = []
        state.pendingUsers = []
      })

      try {
        await supabase.auth.signOut()
      } catch {
        // Ignore — user is already signed out locally
      }
    },

    registerPushToken: async (userId: string) => {
      try {
        if (Platform.OS === 'web') return
        if (Constants.executionEnvironment === 'storeClient') return

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require('expo-notifications')

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

    fetchTeam: async () => {
      const shop = get().shop
      if (!shop?.id) return

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, avatar_url')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: true })

        set((state) => {
          state.team = (data ?? []) as TeamMember[]
        })
      } catch {
        // Non-critical
      }
    },

    createCashier: async (fullName: string, email: string, password: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('ไม่ได้เข้าสู่ระบบ')

      const { data, error } = await supabase.functions.invoke('create-cashier', {
        body: { full_name: fullName, email, password },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      // Refresh team list
      await get().fetchTeam()
    },

    submitOwnerInfo: async (shopName: string, promptpayId: string) => {
      const { error } = await supabase.rpc('submit_owner_info', {
        p_shop_name: shopName.trim(),
        p_promptpay: promptpayId.trim(),
      })
      if (error) throw error

      // Update local profile so routing redirects to pending
      set((state) => {
        if (state.profile) {
          state.profile.pending_shop_name = shopName.trim()
          state.profile.pending_promptpay = promptpayId.trim()
        }
      })
    },

    fetchPendingUsers: async () => {
      try {
        const { data, error } = await supabase.rpc('get_pending_users')
        if (error) throw error
        set((state) => {
          state.pendingUsers = (data ?? []) as PendingUser[]
        })
      } catch (err) {
        if (__DEV__) console.error('[fetchPendingUsers] error:', err)
      }
    },

    approveOwner: async (userId: string, shopName: string, promptpayId: string) => {
      const { error } = await supabase.rpc('approve_owner_signup', {
        p_user_id: userId,
        p_shop_name: shopName.trim(),
        p_promptpay: promptpayId.trim(),
      })

      if (error) throw error

      // Remove from pending list locally
      set((state) => {
        state.pendingUsers = state.pendingUsers.filter((u) => u.id !== userId)
      })
    },

    removeTeamMember: async (profileId: string) => {
      const { error } = await supabase.rpc('remove_team_member', {
        p_profile_id: profileId,
      })

      if (error) throw error

      set((state) => {
        state.team = state.team.filter((m) => m.id !== profileId)
      })
    },
  }))
)
