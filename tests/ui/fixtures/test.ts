import { test as base, expect } from '@playwright/test';
import { SEED_BOOKS } from '../support/data';
import { API_BASE_URL, IS_REAL_API } from '../support/env';
import type { Book } from '../support/types';
import { AddBookPage } from '../pages/AddBookPage';
import { CatalogPage } from '../pages/CatalogPage';
import { MockApi } from './mockApi';
import { RealApi } from './realApi';

export interface CatalogData {
  /** True when running the `integration` project against a real backend. */
  isReal: boolean;
  /** Appended to every seeded title in integration mode ('' when mocked). */
  tag: string;
  /** `base` plus the tag in integration mode, `base` unchanged when mocked. */
  titled: (base: string) => string;
  /** Books present at the start of the test (mock: the whole catalog; real: the books this test created). */
  books: Book[];
  /** Seeds a custom catalog (replaces the mock catalog; adds tagged books on a real backend). */
  seed: (books: readonly Omit<Book, 'createdAt'>[]) => Promise<Book[]>;
}

interface Fixtures {
  /** Internal: the shared in-memory API (null in integration mode). Always attached, seeded with SEED_BOOKS. */
  backend: MockApi | null;
  /** The in-memory API. Tests that use it (error injection, latency, request inspection) are skipped in integration mode. */
  mockApi: MockApi;
  data: CatalogData;
  catalog: CatalogPage;
  addBook: AddBookPage;
}

export const test = base.extend<Fixtures>({
  backend: [
    async ({ page }, use) => {
      if (IS_REAL_API) {
        await use(null);
        return;
      }
      const api = new MockApi(API_BASE_URL);
      api.seed(SEED_BOOKS);
      await api.attach(page);
      await use(api);
    },
    { auto: true },
  ],

  mockApi: async ({ backend }, use, testInfo) => {
    testInfo.skip(backend === null, 'Needs the mocked API (error injection / latency / request inspection)');
    if (backend) await use(backend);
  },

  data: async ({ backend, request }, use, testInfo) => {
    if (backend) {
      await use({ isReal: false, tag: '', titled: (base) => base, books: backend.snapshot(), seed: (b) => Promise.resolve(backend.seed(b)) });
      return;
    }
    const tag = `[e2e-${testInfo.testId.slice(0, 8)}-${String(testInfo.retry)}]`;
    const real = new RealApi(request, API_BASE_URL, tag);
    try {
      const books = await real.seed(SEED_BOOKS);
      await use({ isReal: true, tag, titled: (base) => `${base} ${tag}`, books, seed: (b) => real.seed(b) });
    } finally {
      await real.cleanup();
    }
  },

  catalog: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },

  addBook: async ({ page }, use) => {
    await use(new AddBookPage(page));
  },
});

export { expect };
