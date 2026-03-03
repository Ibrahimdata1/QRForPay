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
  // H-4: PromptPay ID should be fetched from shops table, not bundled in client.
  // EXPO_PUBLIC_* vars are embedded in the JS bundle and visible to all users.
  // Retrieve promptpay_id from the authenticated shop row instead.
  // promptpay: { id: process.env.EXPO_PUBLIC_PROMPTPAY_ID || '' },
};
