/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          dim: 'rgb(var(--color-surface-dim) / <alpha-value>)',
          bright: 'rgb(var(--color-surface-bright) / <alpha-value>)',
          'container-lowest': 'rgb(var(--color-surface-container-lowest) / <alpha-value>)',
          'container-low': 'rgb(var(--color-surface-container-low) / <alpha-value>)',
          container: 'rgb(var(--color-surface-container) / <alpha-value>)',
          'container-high': 'rgb(var(--color-surface-container-high) / <alpha-value>)',
          'container-highest': 'rgb(var(--color-surface-container-highest) / <alpha-value>)',
          variant: 'rgb(var(--color-surface-variant) / <alpha-value>)',
          tint: '#2170e4',
        },
        /** FinClick Premium — лесной зелёный бренд */
        forest: {
          DEFAULT: '#131b2e',
          mid: '#1f2a44',
          soft: '#3f465c',
        },
        /** Stitch action-blue brand */
        primary: {
          DEFAULT: '#0058be',
          dim: '#004395',
          fixed: '#dae2fd',
          'fixed-dim': '#bec6e0',
          container: '#dae2fd',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#131b2e',
          fixed: '#131b2e',
          'fixed-variant': '#3f465c',
        },
        secondary: {
          DEFAULT: '#0058be',
          dim: '#004395',
          fixed: '#d8e2ff',
          'fixed-dim': '#adc6ff',
          container: '#2170e4',
        },
        'on-secondary': { DEFAULT: '#ffffff', container: '#fefcff', fixed: '#001a42', 'fixed-variant': '#004395' },
        /** Success / "ready" green */
        tertiary: {
          DEFAULT: '#009668',
          dim: '#005236',
          fixed: '#6ffbbe',
          'fixed-dim': '#4edea3',
          container: '#002113',
        },
        'on-tertiary': { DEFAULT: '#ffffff', container: '#009668', fixed: '#002113', 'fixed-variant': '#005236' },
        error: {
          DEFAULT: '#ba1a1a',
          dim: '#93000a',
          container: '#ffdad6',
        },
        'on-error': { DEFAULT: '#ffffff', container: '#93000a' },
        'on-surface': {
          DEFAULT: 'rgb(var(--color-on-surface) / <alpha-value>)',
          variant: 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        },
        'on-background': 'rgb(var(--color-on-background) / <alpha-value>)',
        outline: {
          DEFAULT: 'rgb(var(--color-outline) / <alpha-value>)',
          variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
        },
        'inverse-surface': '#2d3133',
        'inverse-on-surface': '#eff1f3',
        'inverse-primary': '#bec6e0',
      },
      fontFamily: {
        headline: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.04)',
        card: '0 4px 24px rgb(0 26 66 / 0.06), 0 16px 48px -12px rgb(0 88 190 / 0.07)',
        lift: '0 12px 40px rgb(0 26 66 / 0.1), 0 32px 64px -24px rgb(0 88 190 / 0.12)',
        glow: '0 0 0 1px rgb(33 112 228 / 0.18), 0 16px 40px -12px rgb(33 112 228 / 0.28)',
        float: '0 24px 80px -32px rgb(0 0 0 / 0.45), 0 8px 32px -12px rgb(0 88 190 / 0.15)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        /** Align with `index.css` `--fc-duration-*` */
        fc: '240ms',
        'fc-fast': '160ms',
        'fc-slow': '320ms',
      },
    },
  },
  plugins: [],
}
