/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        player: {
          1: '#a78bfa',
          2: '#34d399',
          3: '#fb923c',
          4: '#60a5fa',
          5: '#f472b6',
          6: '#facc15',
          7: '#4ade80',
          8: '#f87171',
        },
      },
    },
  },
  plugins: [],
}
