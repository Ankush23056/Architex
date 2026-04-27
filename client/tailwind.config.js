/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-green': '#39FF14',
        'neon-cyan': '#00FFFF',
        'neon-magenta': '#FF00FF',
        'neon-yellow': '#FFE600',
        'groq-orange': '#F55036',
        'electric-purple': '#9D00FF',
        'surface': '#0a0a0a',
        'surface-1': '#111111',
        'surface-2': '#1a1a1a',
        'surface-3': '#242424',
        'border-brutal': '#333333',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '4px 4px 0px #39FF14',
        'brutal-cyan': '4px 4px 0px #00FFFF',
        'brutal-magenta': '4px 4px 0px #FF00FF',
        'brutal-sm': '2px 2px 0px #39FF14',
        'brutal-lg': '6px 6px 0px #39FF14',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
      },
    },
  },
  plugins: [],
}
