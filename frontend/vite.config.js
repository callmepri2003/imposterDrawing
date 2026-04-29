import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      // CanvasManager and SharedCanvas require a real browser canvas API —
      // they're covered by end-to-end tests rather than jsdom unit tests.
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/main.jsx',
        'src/components/canvas/**',
        'src/screens/DrawingScreen.jsx',
        'src/screens/RevealScreen.jsx',
        'src/screens/ErrorScreen.jsx',
        'postcss.config.js',
        'tailwind.config.js',
      ],
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 65,
        statements: 75,
      },
    },
  },
})
