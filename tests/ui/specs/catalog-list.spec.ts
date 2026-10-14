import { expect, test } from '../fixtures/test';
import { isbn13CheckDigit, pick } from '../support/data';
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

  test('@FE-AC1 more than one page: heading shows the total and "Load more" fetches the rest', async ({ catalog, mockApi }) => {
    const books = Array.from({ length: 101 }, (_, i) => {
      const n = String(i).padStart(3, '0');
      const body = `978000000${n}`;
      return {
        id: `d0000000-0000-4000-8000-000000000${n}`,
        title: `Bulk Volume ${n}`,
        author: 'Bulk Author',
        isbn: body + String(isbn13CheckDigit(body)),
        publishedYear: 2001,
        genre: 'HISTORY' as const,
        available: i % 2 === 0,
      };
    });
    mockApi.seed(books);
    await catalog.open();

    await expect(catalog.rows).toHaveCount(100);
    await expect(catalog.resultsHeading).toHaveText('101 books');
    await expect(catalog.resultsStatus).toHaveText('101 books found, 100 shown');
    await expect(catalog.row('Bulk Volume 100')).toHaveCount(0);
    expect(mockApi.listRequests()[0]?.url.searchParams.get('page')).toBe('0');

    await catalog.loadMore.click();
    await expect(catalog.rows).toHaveCount(101);
    await expect(catalog.row('Bulk Volume 100')).toHaveCount(1);
    await expect(catalog.loadMore).toHaveCount(0);
    await expect(catalog.resultsHeading).toBeFocused();
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('page')).toBe('1');
  });
});
