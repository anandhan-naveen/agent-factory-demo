import { expect, test } from '../fixtures/test';
import { newBookInput, pick } from '../support/data';

test.describe('Add book: save', () => {
  test('@FE-AC7 saving a valid book returns to the catalog, confirms and lists it', async ({ page, catalog, addBook, data }) => {
    await catalog.open();
    await catalog.addBookLink.click();
    await expect(page).toHaveURL(/#\/books\/new$/);
    await expect(addBook.heading).toBeVisible();

    const book = newBookInput({ title: data.titled('The Midnight Library'), genre: 'FICTION', publishedYear: 2020 });
    await addBook.fillBook(book);
    await addBook.save.click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(catalog.toast).toHaveText(/Book added/);
    const row = catalog.row(book.title);
    await expect(row).toBeVisible();
    await expect(row).toContainText(book.author);
    await expect(row).toContainText('Fiction');
    await expect(row).toContainText('2020');
    await expect(row.getByTestId('availability-badge')).toHaveText('Available');
  });

  test('@FE-AC7 sends the normalised payload to POST /api/books', async ({ page, addBook, mockApi }) => {
    await addBook.goto();
    await addBook.fill({ title: '  Dune  ', author: ' Frank Herbert ', isbn: '978-0-441-17271-9', publishedYear: '1965', genre: 'FICTION' });
    await addBook.save.click();
    await expect(page).toHaveURL(/#\/$/);
    const posts = mockApi.requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719', publishedYear: 1965, genre: 'FICTION' });
  });

  test('@FE-AC7 duplicate ISBN (409) shows "A book with this ISBN already exists" under ISBN', async ({ page, addBook, data }) => {
    const existing = pick(data.books);
    await addBook.goto();
    await addBook.fillBook(newBookInput({ isbn: existing.isbn, title: data.titled('Another copy') }));
    await addBook.save.click();

    await expect(addBook.error('isbn')).toHaveText('A book with this ISBN already exists');
    await expect(addBook.isbn).toBeFocused();
    await expect(addBook.isbn).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/#\/books\/new$/);
    // The form keeps the user's input so they can correct it.
    await expect(addBook.title).toHaveValue(/^Another copy/);
    await expect(addBook.save).toBeEnabled();
  });

  test('@FE-AC7 server-side validation errors (400) are shown under their fields', async ({ page, addBook }) => {
    await page.route(
      (url) => url.pathname === '/api/books',
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 400,
              contentType: 'application/problem+json',
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ title: 'Validation failed', status: 400, errors: { author: 'Author is blocked by the server' } }),
            })
          : route.fallback(),
    );
    await addBook.goto();
    await addBook.fillBook(newBookInput());
    await addBook.save.click();
    await expect(addBook.error('author')).toHaveText('Author is blocked by the server');
    await expect(addBook.author).toBeFocused();
    await expect(page).toHaveURL(/#\/books\/new$/);
  });

  test('@FE-AC7 a server error on save keeps the user on the form with an alert', async ({ page, addBook, mockApi }) => {
    await addBook.goto();
    await addBook.fillBook(newBookInput());
    mockApi.failNext(500);
    await addBook.save.click();
    await expect(addBook.formAlert).toContainText('Couldn’t save the book.');
    await expect(page).toHaveURL(/#\/books\/new$/);
    await expect(addBook.save).toBeEnabled();
  });

  test('@FE-AC7 Cancel returns to the catalog without saving', async ({ page, addBook, catalog, mockApi }) => {
    await addBook.goto();
    await addBook.fillBook(newBookInput());
    await addBook.cancel.click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(catalog.heading).toBeVisible();
    expect(mockApi.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });
});
