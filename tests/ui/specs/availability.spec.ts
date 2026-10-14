import { expect, test } from '../fixtures/test';
import { pick } from '../support/data';

test.describe('Availability toggle', () => {
  test('@FE-AC8 marking a book on loan and back updates the badge without a reload', async ({ page, catalog, data }) => {
    const book = pick(data.books, (b) => b.available);
    await catalog.open();
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });

    await expect(catalog.badge(book.title)).toHaveText('Available');
    await expect(catalog.toggle(book.title)).toHaveText('Mark on loan');
    await catalog.toggle(book.title).click();
    await expect(catalog.badge(book.title)).toHaveText('On loan');
    await expect(catalog.toggle(book.title)).toHaveText('Mark available');
    await expect(catalog.toggle(book.title)).toHaveAccessibleName(`Mark ${book.title} as available`);

    await catalog.toggle(book.title).click();
    await expect(catalog.badge(book.title)).toHaveText('Available');

    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });

  test('@FE-AC8 toggle sends PATCH /availability and does not refetch the list', async ({ catalog, mockApi }) => {
    const book = pick(mockApi.snapshot(), (b) => !b.available);
    await catalog.open();
    const listsBefore = mockApi.listRequests().length;

    await catalog.toggle(book.title).click();
    await expect(catalog.badge(book.title)).toHaveText('Available');
    await expect(catalog.toast).toContainText('marked available');

    const patch = mockApi.requests.find((r) => r.method === 'PATCH');
    expect(patch?.url.pathname).toBe(`/api/books/${book.id}/availability`);
    expect(patch?.body).toEqual({ available: true });
    expect(mockApi.listRequests()).toHaveLength(listsBefore);
    // Other rows are untouched.
    for (const other of mockApi.snapshot().filter((b) => b.id !== book.id)) {
      await expect(catalog.badge(other.title)).toHaveText(other.available ? 'Available' : 'On loan');
    }
  });

  test('@FE-AC8 a failed toggle leaves the badge unchanged and tells the user', async ({ catalog, mockApi }) => {
    const book = pick(mockApi.snapshot(), (b) => b.available);
    await catalog.open();
    mockApi.failNext(500);
    await catalog.toggle(book.title).click();
    await expect(catalog.toast).toContainText('Couldn’t update');
    await expect(catalog.badge(book.title)).toHaveText('Available');
    await expect(catalog.toggle(book.title)).toBeEnabled();
  });

  test('@FE-AC3 @FE-AC8 with "Available only" on, a book marked on loan drops out of the list', async ({ catalog, mockApi }) => {
    const book = pick(mockApi.snapshot(), (b) => b.available);
    const availableCount = mockApi.snapshot().filter((b) => b.available).length;
    await catalog.open();
    await catalog.availableOnly.check();
    await expect(catalog.rows).toHaveCount(availableCount);

    await catalog.toggle(book.title).click();
    await expect(catalog.row(book.title)).toHaveCount(0);
    await expect(catalog.rows).toHaveCount(availableCount - 1);
    await expect(catalog.resultsHeading).toHaveText(`${String(availableCount - 1)} books`);
    await expect(catalog.resultsHeading).toBeFocused();
    await expect(catalog.toast).toContainText('marked on loan');
  });
});
