// ============================================================
// Acolyte Design Tokens — Single source of truth
// Shared between web (shadcn/Tailwind) and mobile (NativeWind)
// ============================================================

export const colors = {
  // Brand — Emerald Green family
  brand: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#00C853', // Primary brand color
    600: '#00B848',
    700: '#00A83D',
    800: '#009832',
    900: '#007A27',
  },

  // Teal accent (B2B dashboards)
  teal: {
    50: '#E0F2F1',
    100: '#B2DFDB',
    200: '#80CBC4',
    300: '#4DB6AC',
    400: '#26A69A',
    500: '#009688',
    600: '#00897B',
    700: '#00796B',
    800: '#00695C',
    900: '#004D40',
  },

  // Dark mode backgrounds
  dark: {
    bg: '#0A0A0A',
    surface: '#111111',
    elevated: '#1A1A1A',
    overlay: '#1A1A2E',
    border: '#2A2A2A',
    muted: '#3A3A3A',
  },

  // Light mode backgrounds (admin dashboards)
  light: {
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    elevated: '#F1F5F9',
    border: '#E2E8F0',
    muted: '#94A3B8',
  },

  // Semantic colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Compliance status colors
  compliance: {
    green: '#22C55E',
    yellow: '#F59E0B',
    orange: '#F97316',
    red: '#EF4444',
  },

  // Text
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverse: '#0F172A',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Menlo, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
} as const;
