import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui-tokens/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#00C853',
          600: '#00B848',
          700: '#00A83D',
          800: '#009832',
          900: '#007A27',
        },
        dark: {
          bg: '#0A0A0A',
          surface: '#111111',
          elevated: '#1A1A1A',
          overlay: '#1A1A2E',
          border: '#2A2A2A',
          muted: '#3A3A3A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
