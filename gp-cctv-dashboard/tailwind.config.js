/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Command-center surface palette
        base: {
          900: '#05070f', // app background (near black navy)
          800: '#080c18',
          700: '#0a0f1e',
        },
        panel: {
          DEFAULT: '#0b1222', // panel body
          head: '#0c1425',
          alt: '#101a2e', // inner tiles / inputs
          hover: '#132038',
        },
        edge: {
          DEFAULT: '#1a2942', // thin blue-gray border
          soft: '#152238',
          strong: '#25395a',
        },
        ink: {
          DEFAULT: '#e6edf7',
          dim: '#93a3bd',
          faint: '#65799b',
        },
        accent: {
          blue: '#2f7dff',
          cyan: '#22d3ee',
          green: '#22c55e',
          orange: '#f59e0b',
          red: '#ef4444',
          purple: '#a855f7',
          yellow: '#eab308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '13px'],
        '3xs': ['9px', '12px'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
        glow: '0 0 18px -4px rgba(47,125,255,0.45)',
        'glow-red': '0 0 22px -4px rgba(239,68,68,0.55)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.85)' },
        },
        sweep: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        ping2: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        // Alerts page: new activity row, slide-over details panel, overlays
        flashIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drawerIn: {
          '0%': { opacity: '0.35', transform: 'translateX(26px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
        sweep: 'sweep 4.5s linear infinite',
        ping2: 'ping2 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'flash-in': 'flashIn 0.45s ease-out both',
        'drawer-in': 'drawerIn 0.24s cubic-bezier(0.22,0.9,0.3,1) both',
        'fade-in': 'fadeIn 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
