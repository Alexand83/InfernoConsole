/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dj-primary': 'var(--dj-primary)',
        'dj-secondary': 'var(--dj-secondary)',
        'dj-accent': 'var(--dj-accent)',
        'dj-highlight': 'var(--dj-highlight)',
        'dj-success': 'var(--dj-success)',
        'dj-warning': 'var(--dj-warning)',
        'dj-error': 'var(--dj-error)',
        'dj-dark': 'var(--dj-dark)',
        'dj-light': 'var(--dj-light)',
        'dj-accent-20': 'var(--dj-accent-20)',
        'dj-accent-30': 'var(--dj-accent-30)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'wave': 'wave 1.5s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(20deg)' },
          '75%': { transform: 'rotate(-20deg)' },
        }
      },
      fontFamily: {
        'dj': ['Orbitron', 'monospace'],
        'sans': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
