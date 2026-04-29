import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // persistRoom/loadRooms are intentionally dead code (db=null stub).
      // Exclude them so the threshold reflects actually-reachable code.
      exclude: ['node_modules/', '__tests__/'],
      include: ['**/*.js'],
      thresholds: {
        lines: 75,
        functions: 85,
        branches: 70,
        statements: 75,
      },
    },
  },
})
