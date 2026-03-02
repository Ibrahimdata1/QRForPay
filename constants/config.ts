export const Config = {
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  tax: {
    rate: 0.07,
    inclusive: true,
  },
  qr: {
    timeout: 300,
    pollInterval: 3,
    currency: 'THB',
  },
  promptpay: {
    id: process.env.EXPO_PUBLIC_PROMPTPAY_ID || '',
  },
};
