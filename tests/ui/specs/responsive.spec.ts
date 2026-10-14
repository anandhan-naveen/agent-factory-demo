import { expect, test } from '../fixtures/test';
import { expectNoHorizontalScroll } from '../support/assertions';
import { pick } from '../support/data';

const WIDTHS = [360, 768, 1280] as const;

for (const width of WIDTHS) {
  test.describe(`${String(width)} px viewport`, () => {
    test.use({ viewport: { width, height: 800 } });

    test(`@FE-AC11 catalog has no horizontal scroll at ${String(width)} px`, async ({ page, catalog, data }) => {
      const book = pick(data.books);
      await catalog.open();
      await expect(catalog.rows.first()).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Inline delete confirmation and toast must also fit.
      await catalog.toggle(book.title).click();
      await expect(catalog.toast).toBeVisible();
      await catalog.deleteButton(book.title).click();
      await expect(catalog.confirmDelete(book.title)).toBeVisible();
      await expectNoHorizontalScroll(page);

      await catalog.searchFor('zz-no-such-book-zz');
      await expect(catalog.emptyState).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test(`@FE-AC11 add book form has no horizontal scroll at ${String(width)} px`, async ({ page, addBook }) => {
      await addBook.goto();
      await expect(addBook.heading).toBeVisible();
      await expectNoHorizontalScroll(page);
      await addBook.save.click();
      await expect(addBook.error('title')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  });
}

test.describe('360 px edge cases', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('@FE-AC11 long titles and the error state fit at 360 px', async ({ page, catalog, mockApi }) => {
    mockApi.seed([
      {
        id: 'b0000001-0000-4000-8000-0000000000aa',
        title: 'Supercalifragilisticexpialidocious-Antidisestablishmentarianism-Pneumonoultramicroscopic',
        author: 'An Author With A Remarkably Long Hyphenated-Double-Barrelled-Surname',
        isbn: '9780061120084',
        publishedYear: 2001,
        genre: 'NON_FICTION',
        available: false,
      },
    ]);
    await catalog.open();
    await expect(catalog.rows).toHaveCount(1);
    await expectNoHorizontalScroll(page);

    mockApi.failNext(500);
    await page.reload();
    await expect(catalog.errorState).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
