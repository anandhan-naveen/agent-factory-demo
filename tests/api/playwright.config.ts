import { defineConfig } from '@playwright/test';

const baseURL = process.env.API_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list']],
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json, application/problem+json' },
  },
});
