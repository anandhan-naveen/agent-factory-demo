import { expect, test } from '../fixtures/test';
import { pick } from '../support/data';
import { GENRE_LABELS } from '../support/types';

test.describe('Catalog list', () => {
  test('@FE-AC1 shows every book with title, author, genre, year and availability badge', async ({ catalog, data }) => {
    await catalog.open();
    await expect(catalog.heading).toBeVisible();

    for (const book of data.books) {
      const row = catalog.row(book.title);
      await expect(row, book.title).toHaveCount(1);
      await expect(row.getByTestId('book-title')).toHaveText(book.title);
      await expect(row).toContainText(book.author);
      await expect(row).toContainText(GENRE_LABELS[book.genre]);
      await expect(row).toContainText(String(book.publishedYear));
      await expect(row.getByTestId('availability-badge')).toHaveText(book.available ? 'Available' : 'On loan');
    }
  });

  test('@FE-AC1 renders both badge variants', async ({ catalog, data }) => {
    await catalog.open();
    const available = pick(data.books, (b) => b.available);
    const onLoan = pick(data.books, (b) => !b.available);
    await expect(catalog.badge(available.title)).toHaveText('Available');
    await expect(catalog.badge(onLoan.title)).toHaveText('On loan');
  });

  test('@FE-AC1 shows a loading indicator while the request is in flight', async ({ catalog, mockApi }) => {
    mockApi.delay(1_000);
    await catalog.goto();
    await expect(catalog.loading).toBeVisible();
    await expect(catalog.loading).toHaveRole('status');
    await expect(catalog.loading).toContainText('Loading books');
    await expect(catalog.rows).toHaveCount(0);

    await expect(catalog.loading).toHaveCount(0, { timeout: 5_000 });
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });

  test('@FE-AC1 lists exactly the books returned by the API, in API order', async ({ catalog, mockApi }) => {
    await catalog.open();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
    expect(await catalog.titles()).toEqual(mockApi.snapshot().map((b) => b.title));
    await expect(catalog.resultsHeading).toHaveText(`${String(mockApi.snapshot().length)} books`);
  });

  test('@FE-AC1 requests the catalog once on load via GET /api/books', async ({ catalog, mockApi }) => {
    await catalog.open();
    const requests = mockApi.listRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.searchParams.has('q')).toBe(false);
  });
});
