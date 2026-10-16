import { expect, test } from '../fixtures/test';
import { pick } from '../support/data';

test.describe('Delete', () => {
  // FE-AC9: no browser dialogs allowed. Any alert/confirm/prompt fails the test.
  let dialogs: string[] = [];

  test.beforeEach(({ page }) => {
    dialogs = [];
    page.on('dialog', (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`);
      void dialog.dismiss();
    });
  });

  test.afterEach(() => {
    expect(dialogs, 'browser dialogs were opened').toEqual([]);
  });

  test('@FE-AC9 delete asks for in-page confirmation, confirming removes the book', async ({ catalog, data }) => {
    const book = pick(data.books);
    await catalog.open();

    await catalog.deleteButton(book.title).click();
    await expect(catalog.row(book.title).getByRole('group', { name: `Confirm deleting ${book.title}` })).toBeVisible();
    await expect(catalog.row(book.title)).toContainText('Delete this book?');
    await expect(catalog.cancelDelete(book.title)).toBeFocused();

    await catalog.confirmDelete(book.title).click();
    await expect(catalog.row(book.title)).toHaveCount(0);
    await expect(catalog.toast).toContainText('deleted');
    for (const other of data.books.slice(1)) await expect(catalog.row(other.title)).toHaveCount(1);
  });

  test('@FE-AC9 confirming sends DELETE and updates the count', async ({ catalog, mockApi }) => {
    const books = mockApi.snapshot();
    const book = pick(books, (b) => b.genre === 'SCIENCE');
    await catalog.open();
    await expect(catalog.resultsHeading).toHaveText(`${String(books.length)} books`);

    await catalog.deleteButton(book.title).click();
    await catalog.confirmDelete(book.title).click();
    await expect(catalog.rows).toHaveCount(books.length - 1);
    await expect(catalog.resultsHeading).toHaveText(`${String(books.length - 1)} books`);
    const del = mockApi.requests.find((r) => r.method === 'DELETE');
    expect(del?.url.pathname).toBe(`/api/books/${book.id}`);
    expect(mockApi.snapshot().some((b) => b.id === book.id)).toBe(false);
  });

  test('@FE-AC9 cancel (click or Escape) keeps the book', async ({ catalog, mockApi }) => {
    const book = pick(mockApi.snapshot());
    await catalog.open();

    await catalog.deleteButton(book.title).click();
    await catalog.cancelDelete(book.title).click();
    await expect(catalog.confirmDelete(book.title)).toHaveCount(0);
    await expect(catalog.deleteButton(book.title)).toBeFocused();

    await catalog.deleteButton(book.title).click();
    await catalog.page.keyboard.press('Escape');
    await expect(catalog.confirmDelete(book.title)).toHaveCount(0);
    await expect(catalog.row(book.title)).toHaveCount(1);
    expect(mockApi.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  });

  test('@FE-AC9 a failed delete keeps the book and reports the error', async ({ catalog, mockApi }) => {
    const book = pick(mockApi.snapshot());
    await catalog.open();
    await catalog.deleteButton(book.title).click();
    mockApi.failNext(500);
    await catalog.confirmDelete(book.title).click();
    await expect(catalog.toast).toContainText('Couldn’t delete');
    await expect(catalog.row(book.title)).toHaveCount(1);
    await expect(catalog.deleteButton(book.title)).toBeEnabled();
  });
});
