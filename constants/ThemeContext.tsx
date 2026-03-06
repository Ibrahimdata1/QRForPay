import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Light palette ────────────────────────────────────────────────────────────

const LightColors = {
  primary: '#0F766E',
  primaryLight: '#F0FDFA',
  primaryMid: '#CCFBF1',
  secondary: '#059669',
  accent: '#8B5CF6',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  success: '#10B981',
  successLight: '#ECFDF5',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    light: '#94A3B8',
    inverse: '#FFFFFF',
  },
  qr: { background: '#FFFFFF', foreground: '#0F766E' },
  category: { food: '#F87171', drink: '#2DD4BF', goods: '#FBBF24', default: '#94A3B8' },
  gradient: {
    primary:  ['#064E46', '#0F9688'] as string[],
    success:  ['#065F46', '#059669'] as string[],
    accent:   ['#5B21B6', '#7C3AED'] as string[],
    danger:   ['#991B1B', '#EF4444'] as string[],
    warm:     ['#92400E', '#F59E0B'] as string[],
    avatar: [
      ['#0E7490', '#22D3EE'] as string[],
      ['#5B21B6', '#A78BFA'] as string[],
      ['#065F46', '#34D399'] as string[],
      ['#92400E', '#FCD34D'] as string[],
      ['#9D174D', '#F9A8D4'] as string[],
    ],
  },
};

// ─── Dark palette ─────────────────────────────────────────────────────────────

const DarkColors = {
  primary: '#14B8A6',
  primaryLight: '#042F2E',
  primaryMid: '#0D4037',
  secondary: '#34D399',
  accent: '#A78BFA',
  danger: '#F87171',
  dangerLight: '#450A0A',
  warning: '#FCD34D',
  warningLight: '#451A03',
  success: '#34D399',
  successLight: '#052E16',
  info: '#60A5FA',
  infoLight: '#172554',
  background: '#09090B',
  surface: '#18181B',
  border: '#3F3F46',
  borderLight: '#27272A',
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    light: '#71717A',
    inverse: '#09090B',
  },
  qr: { background: '#FFFFFF', foreground: '#0F766E' },
  category: { food: '#F87171', drink: '#2DD4BF', goods: '#FCD34D', default: '#71717A' },
  gradient: {
    primary:  ['#042F2E', '#0D9488'] as string[],
    success:  ['#052E16', '#059669'] as string[],
    accent:   ['#2E1065', '#7C3AED'] as string[],
    danger:   ['#450A0A', '#EF4444'] as string[],
    warm:     ['#451A03', '#F59E0B'] as string[],
    avatar: [
      ['#0E4A5C', '#0891B2'] as string[],
      ['#2E1065', '#7C3AED'] as string[],
      ['#052E16', '#059669'] as string[],
      ['#451A03', '#D97706'] as string[],
      ['#4A0528', '#DB2777'] as string[],
    ],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeColors = typeof LightColors;

type ThemeOverride = 'light' | 'dark' | null;

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  override: ThemeOverride;
  setOverride: (v: ThemeOverride) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@qrforpay:theme_override';

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  override: null,
  setOverride: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverrideState] = useState<ThemeOverride>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark') setOverrideState(val);
      setHydrated(true);
    });
  }, []);

  const setOverride = (v: ThemeOverride) => {
    setOverrideState(v);
    if (v === null) AsyncStorage.removeItem(STORAGE_KEY);
    else AsyncStorage.setItem(STORAGE_KEY, v);
  };

  const isDark = override ? override === 'dark' : systemScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  // Avoid flash of wrong theme before hydration
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={{ colors, isDark, override, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
