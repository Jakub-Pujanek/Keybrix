import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov'],
      all: true,
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/out/**']
    }
  },
  plugins: [react()]
})
