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
 * Demo mode (`demo` project, R-FE-02): the app is built exactly as GitHub Pages deploys it (empty
 * VITE_API_BASE_URL, in-browser demo API) into tests/ui/.app-dist-demo, served on UI_TEST_PORT + 1,
 * and the smoke specs in ./demo run against it.
 * Integration mode: set E2E_REAL_API=<backend base URL>; the app is built against it and the
 * `integration` project runs the same specs without route mocking.
 */
const PORT = Number(process.env.UI_TEST_PORT ?? 4173);
const DEMO_PORT = PORT + 1;
const demoOutDir = path.resolve(here, '.app-dist-demo');
const isCI = Boolean(process.env.CI);

const vite = path.join(frontendDir, 'node_modules', '.bin', 'vite');

const baseUrl = (port: number): string => `http://localhost:${String(port)}/`;

/** Builds the frontend into `dir` (never into frontend/) and serves it with `vite preview`. */
function appServer(apiBaseUrl: string, dir: string, port: number) {
  return {
    command: `"${vite}" build --outDir "${dir}" --emptyOutDir && "${vite}" preview --outDir "${dir}" --port ${String(port)} --strictPort`,
    cwd: frontendDir,
    env: { VITE_API_BASE_URL: apiBaseUrl },
    url: baseUrl(port),
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore' as const,
    stderr: 'pipe' as const,
  };
}

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
    baseURL: baseUrl(PORT),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: IS_REAL_API
    ? [{ name: 'integration', use: { ...devices['Desktop Chrome'] }, metadata: { realApi: true } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] }, metadata: { realApi: false } },
        { name: 'demo', testDir: './demo', use: { ...devices['Desktop Chrome'], baseURL: baseUrl(DEMO_PORT) }, metadata: { realApi: false, demo: true } },
      ],
  webServer: IS_REAL_API
    ? [appServer(API_BASE_URL, outDir, PORT)]
    : [appServer(API_BASE_URL, outDir, PORT), appServer('', demoOutDir, DEMO_PORT)],
});
