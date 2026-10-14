import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API_BASE_URL, IS_REAL_API } from './support/env';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, '../../frontend');
const outDir = path.resolve(here, '.app-dist');

/**
 * Mocked mode (default): the app is built with VITE_API_BASE_URL=http://api.test and every
 * request to that host is answered by the in-memory `mockApi` fixture.
 * Integration mode: set E2E_REAL_API=<backend base URL>; the app is built against it and the
 * `integration` project runs the same specs without route mocking.
 */
const PORT = Number(process.env.UI_TEST_PORT ?? 4173);
const isCI = Boolean(process.env.CI);

const vite = path.join(frontendDir, 'node_modules', '.bin', 'vite');

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 2 } : {}),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(PORT)}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: IS_REAL_API
    ? [{ name: 'integration', use: { ...devices['Desktop Chrome'] }, metadata: { realApi: true } }]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, metadata: { realApi: false } }],
  webServer: {
    // Build into tests/ui/.app-dist (never into frontend/) and serve it with `vite preview`.
    command: `"${vite}" build --outDir "${outDir}" --emptyOutDir && "${vite}" preview --outDir "${outDir}" --port ${String(PORT)} --strictPort`,
    cwd: frontendDir,
    env: { VITE_API_BASE_URL: API_BASE_URL },
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
