// Customer-facing Supabase client.
// Runs in the browser (Expo Web) with the anon key — no auth session.
// RLS policies grant anon access only to public menu data and customer orders.

import { createClient } from '@supabase/supabase-js'
import { Config } from '../../constants/config'

export const supabaseCustomer = createClient(
  Config.supabase.url,
  Config.supabase.anonKey,
  {
    auth: {
      // Customers are anonymous — no session persistence needed
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)
