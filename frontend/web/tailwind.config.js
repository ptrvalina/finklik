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
          tint: '#0d9488',
        },
        primary: {
          DEFAULT: '#0d9488',
          dim: '#0f766e',
          fixed: '#14b8a6',
          'fixed-dim': '#0d9488',
          container: '#2dd4bf',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#042f2e',
          fixed: '#ffffff',
          'fixed-variant': '#f0fdfa',
        },
        secondary: {
          DEFAULT: '#059669',
          dim: '#047857',
          fixed: '#10b981',
          'fixed-dim': '#059669',
          container: '#d1fae5',
        },
        'on-secondary': { DEFAULT: '#ffffff', container: '#064e3b', fixed: '#ffffff', 'fixed-variant': '#065f46' },
        tertiary: {
          DEFAULT: '#7c3aed',
          dim: '#6d28d9',
          fixed: '#8b5cf6',
          'fixed-dim': '#7c3aed',
          container: '#ede9fe',
        },
        'on-tertiary': { DEFAULT: '#ffffff', container: '#4c1d95', fixed: '#ffffff', 'fixed-variant': '#5b21b6' },
        error: {
          DEFAULT: '#dc2626',
          dim: '#b91c1c',
          container: '#fee2e2',
        },
        'on-error': { DEFAULT: '#ffffff', container: '#7f1d1d' },
        'on-surface': {
          DEFAULT: 'rgb(var(--color-on-surface) / <alpha-value>)',
          variant: 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        },
        'on-background': 'rgb(var(--color-on-background) / <alpha-value>)',
        outline: {
          DEFAULT: 'rgb(var(--color-outline) / <alpha-value>)',
          variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
        },
        'inverse-surface': '#18181b',
        'inverse-on-surface': '#fafafa',
        'inverse-primary': '#5eead4',
      },
      fontFamily: {
        headline: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
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
        card: '0 2px 8px rgb(15 23 42 / 0.05), 0 12px 32px rgb(15 23 42 / 0.04)',
        lift: '0 8px 24px rgb(15 23 42 / 0.08), 0 24px 48px -12px rgb(15 23 42 / 0.14)',
        glow: '0 0 0 1px rgb(13 148 136 / 0.12), 0 10px 28px -10px rgb(13 148 136 / 0.28)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
