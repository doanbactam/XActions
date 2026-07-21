import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'archive', 'tests/api/**', 'tests/docs/**', 'tests/mcp/**'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'archive/',
        'scripts/',
        '*.config.js',
      ],
    },
  },
});
