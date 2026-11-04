import porcicontrol from './src/design-system/tailwind.preset.js';
import { coloresMarca } from './src/design-system/tailwind.marca.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [porcicontrol],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      colors: {
        ...coloresMarca,
      },
      // Las vistas sin migrar usan rounded-xl/2xl/3xl, font-black y shadow-lg/xl.
      // Se alinean aquí con los tokens para que se vean igual que el Panel principal.
      borderRadius: {
        xl: 'var(--radius-md)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-lg)',
      },
      fontWeight: {
        black: '800',
      },
      boxShadow: {
        sm: 'var(--shadow-card)',
        DEFAULT: 'var(--shadow-card)',
        md: 'var(--shadow-card)',
        lg: 'var(--shadow-card)',
        xl: 'var(--shadow-pop)',
        '2xl': 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
}
