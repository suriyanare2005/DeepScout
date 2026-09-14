/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#F7F3E8', dark: '#EDE8DC' },
        ivory: { DEFAULT: '#F6F1E7', dark: '#ECE7DC' },
        gold: { light: '#FEF3C7', DEFAULT: '#F4C542', dark: '#E9B82E', deep: '#D4A017' },
        olive: { light: '#A5AD86', DEFAULT: '#7C8460', dark: '#69714F', deep: '#5C6347' },
        charcoal: { light: '#5C5850', DEFAULT: '#252321', dark: '#191817' },
        warm: { gray: '#77736B', border: '#E5DFD3', muted: '#9E988D' },
      },
      fontFamily: {
        editorial: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem', '6xl': '3rem' },
      animation: {
        'float': 'float 4.5s ease-in-out infinite',
        'float-reverse': 'floatReverse 5s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'shimmer': 'shimmer 1.5s ease infinite',
        'spin-slow': 'spin 10s linear infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        floatReverse: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(8px)' } },
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseSoft: { '0%, 100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      boxShadow: {
        'warm-sm': '0 2px 8px -2px rgba(25,24,23,0.08)',
        'warm': '0 8px 24px -4px rgba(25,24,23,0.10)',
        'warm-lg': '0 20px 48px -8px rgba(25,24,23,0.14)',
        'gold': '0 4px 16px rgba(244,197,66,0.35)',
        'gold-lg': '0 8px 28px rgba(244,197,66,0.50)',
      },
      maxWidth: { '8xl': '88rem' },
    },
  },
  plugins: [],
}

