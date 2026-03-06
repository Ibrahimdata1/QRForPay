// QRForPay Design System — SaaS Mobile Theme
// ใช้ร่วมกับ Colors จาก constants/colors.ts

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  bottom: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const typography = {
  display:  { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  title:    { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading:  { fontSize: 18, fontWeight: '700' as const },
  subhead:  { fontSize: 16, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const },
  label:    { fontSize: 14, fontWeight: '500' as const },
  caption:  { fontSize: 13, fontWeight: '400' as const },
  small:    { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
} as const;
