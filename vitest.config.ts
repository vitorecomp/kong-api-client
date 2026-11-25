import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'contract',
          include: ['test/contract/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'live',
          include: ['test/live/**/*.test.ts'],
          pool: 'forks',
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'live-destructive',
          include: ['test/live-destructive/**/*.test.ts'],
          pool: 'forks',
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
