import { expect, test } from '../fixtures/test';
import { isbn13CheckDigit } from '../support/data';
import { expectToastKeepsFocusVisible } from '../support/toastClearance';
import { GENRES, type Book } from '../support/types';

/** Enough books that the catalog scrolls at every viewport size. */
const LONG_CATALOG_SIZE = 24;

/** Deterministic books so the catalog scrolls at every viewport size. */
function longCatalog(): Omit<Book, 'createdAt'>[] {
  return Array.from({ length: LONG_CATALOG_SIZE }, (_, i) => {
    const body = `978000000${String(i).padStart(3, '0')}`;
    return {
      id: `d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      title: `Shelf test book ${String(i + 1)}`,
      author: `Author ${String(i + 1)}`,
      isbn: body + String(isbn13CheckDigit(body)),
      publishedYear: 1990 + i,
      genre: GENRES[i % GENRES.length] ?? 'FICTION',
      available: i % 2 === 0,
    };
  });
}

// BUG-38 (QA run 2026-10-17, D9): the toast covered the focused toggle and the badge it had just changed.
for (const viewport of [
  { width: 360, height: 780 },
  { width: 1280, height: 800 },
]) {
  test.describe(`Toast vs keyboard focus at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport });

    test(`@BUG-38 @FE-AC10 toast never covers the focused toggle or its badge (${String(viewport.width)} px)`, async ({ page, catalog, mockApi }) => {
      const books = longCatalog();
      mockApi.seed(books);
      await catalog.open();
      await expect(catalog.rows).toHaveCount(books.length);
      await expectToastKeepsFocusVisible(page, catalog);
    });
  });
}

// R3-FE-02: releasing the reserved toast space while scrolled to the bottom clamped the scroll and the page jumped ~90 px.
test.describe('Toast close at the bottom of the page', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('@BUG-38 @FE-AC10 closing the toast does not make the page jump', async ({ page, catalog, mockApi }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const books = longCatalog();
    mockApi.seed(books);
    await catalog.open();
    await expect(catalog.rows).toHaveCount(books.length);

    const toggle = catalog.rows.last().getByTestId('toggle-availability');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(catalog.toast).toBeVisible();
    // Scroll into the space reserved for the toast: the very bottom of the page.
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    const before = await toggle.boundingBox();

    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(catalog.toast).toHaveCount(0);
    const after = await toggle.boundingBox();
    expect(before).not.toBeNull();
    expect(after?.y).toBeCloseTo(before?.y ?? Number.NaN, 0);
  });
});
