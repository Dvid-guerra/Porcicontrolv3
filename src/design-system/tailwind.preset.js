// Preset de Tailwind del sistema de diseño Porcicontrol.
// Uso en tailwind.config.js:  presets: [porcicontrolPreset]
// Requiere cargar tokens.css antes de los estilos de Tailwind.
// Solo agrega nombres nuevos (rounded-ds-*, font-ui, font-data): no cambia el resto de la app.
const tokenColors = [
  'surface', 'surface-raised', 'surface-sunken',
  'ink', 'ink-muted',
  'line', 'line-strong',
  'primary', 'primary-hover', 'on-primary', 'primary-soft', 'on-primary-soft',
  'focus', 'accent', 'highlight',
  'sidebar', 'sidebar-ink', 'sidebar-muted', 'sidebar-active', 'sidebar-line',
  'success', 'success-soft', 'warning', 'warning-soft',
  'danger', 'danger-soft', 'info', 'info-soft',
  'chart-actual', 'chart-target',
];

const scale = (name, steps) => ({
  DEFAULT: `var(--${name})`,
  ...Object.fromEntries(steps.map((step) => [step, `var(--${name}-${step})`])),
});

export default {
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(tokenColors.map((name) => [name, `var(--${name})`])),
        forest: scale('forest', [100, 200, 950]),
        olive: scale('olive', [100, 800]),
        wheat: scale('wheat', [100, 700]),
        earth: scale('earth', [100]),
        cream: 'var(--cream)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        ui: 'var(--font-sans)',
        data: 'var(--font-mono)',
      },
      borderRadius: {
        'ds-sm': 'var(--radius-sm)',
        'ds-md': 'var(--radius-md)',
        'ds-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      height: {
        'control-sm': 'var(--control-sm)',
        'control-md': 'var(--control-md)',
        'control-field': 'var(--control-field)',
        topbar: 'var(--topbar-height)',
      },
      minHeight: {
        'control-field': 'var(--control-field)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
      },
    },
  },
};
