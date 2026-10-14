import { test as base, expect } from '@playwright/test';
import { AddBookPage } from '../pages/AddBookPage';
import { CatalogPage } from '../pages/CatalogPage';

/** Marker kept in sessionStorage so the clear runs once per test, not on every reload. */
const CLEARED_FLAG = 'e2e-demo-storage-cleared';

interface DemoFixtures {
  catalog: CatalogPage;
  addBook: AddBookPage;
  /** URLs of every request the demo build sent to a books API (must stay empty: demo mode is in-browser). */
  apiRequests: string[];
}

/**
 * Fixtures for the `demo` project: the Pages build with no backend. Each test starts from the
 * demo seed: localStorage is cleared before the app's first script runs, once per test, so a
 * reload inside the test still sees the data the test wrote.
 */
export const test = base.extend<DemoFixtures>({
  page: async ({ page }, use) => {
    await page.addInitScript((flag) => {
      if (window.sessionStorage.getItem(flag) === null) {
        window.localStorage.clear();
        window.sessionStorage.setItem(flag, '1');
      }
    }, CLEARED_FLAG);
    await use(page);
  },

  apiRequests: [
    async ({ page }, use) => {
      const urls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/books')) urls.push(request.url());
      });
      await use(urls);
      expect(urls, 'the demo build must not call a books API').toEqual([]);
    },
    { auto: true },
  ],

  catalog: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },

  addBook: async ({ page }, use) => {
    await use(new AddBookPage(page));
  },
});

export { expect };
