import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['backend/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
})
