export const Colors = {
  // Brand
  primary: '#0F766E',
  primaryLight: '#F0FDFA',
  primaryMid: '#CCFBF1',
  secondary: '#059669',
  accent: '#8B5CF6',

  // Semantic
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  success: '#10B981',
  successLight: '#ECFDF5',
  info: '#3B82F6',
  infoLight: '#EFF6FF',

  // Layout (Slate scale — SaaS standard)
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text (Slate scale)
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    light: '#94A3B8',
    inverse: '#FFFFFF',
  },

  qr: {
    background: '#FFFFFF',
    foreground: '#0F766E',
  },

  category: {
    food: '#F87171',
    drink: '#2DD4BF',
    goods: '#FBBF24',
    default: '#94A3B8',
  },

  // Gradient pairs — use with expo-linear-gradient
  gradient: {
    primary:   ['#064E46', '#0F9688'] as string[],
    success:   ['#065F46', '#059669'] as string[],
    accent:    ['#5B21B6', '#7C3AED'] as string[],
    danger:    ['#991B1B', '#EF4444'] as string[],
    warm:      ['#92400E', '#F59E0B'] as string[],
    avatar: [
      ['#0E7490', '#22D3EE'] as string[], // cyan
      ['#5B21B6', '#A78BFA'] as string[], // violet
      ['#065F46', '#34D399'] as string[], // emerald
      ['#92400E', '#FCD34D'] as string[], // amber
      ['#9D174D', '#F9A8D4'] as string[], // pink
    ],
  },
} as const;
