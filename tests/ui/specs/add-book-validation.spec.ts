import { expect, test } from '../fixtures/test';
import { CURRENT_YEAR, newBookInput, randomIsbn, withBadCheckDigit } from '../support/data';

test.describe('Add book: validation on submit', () => {
  test.beforeEach(async ({ addBook }) => {
    await addBook.goto();
    await expect(addBook.heading).toBeVisible();
  });

  test('@FE-AC6 empty submit shows an error under every field and focuses Title', async ({ addBook, mockApi }) => {
    // Nothing is validated before submit.
    await expect(addBook.page.locator('[data-testid^="error-"]')).toHaveCount(0);
    await addBook.save.click();

    await expect(addBook.error('title')).toHaveText('Title is required');
    await expect(addBook.error('author')).toHaveText('Author is required');
    await expect(addBook.error('isbn')).toHaveText('ISBN is required');
    await expect(addBook.error('publishedYear')).toHaveText('Published year is required');
    await expect(addBook.error('genre')).toHaveText('Choose a genre');
    await expect(addBook.title).toBeFocused();
    await expect(addBook.title).toHaveAttribute('aria-invalid', 'true');
    await expect(addBook.title).toHaveAccessibleDescription(/Title is required/);
    expect(mockApi.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  test('@FE-AC6 first invalid field gets focus (ISBN with a bad checksum)', async ({ addBook }) => {
    const book = newBookInput();
    await addBook.fillBook({ ...book, isbn: withBadCheckDigit(book.isbn) });
    await addBook.save.click();
    await expect(addBook.error('isbn')).toHaveText('This ISBN-13 has an invalid check digit');
    await expect(addBook.isbn).toBeFocused();
    await expect(addBook.isbn).toHaveAccessibleDescription(/invalid check digit/);
    for (const f of ['title', 'author', 'publishedYear', 'genre'] as const) await expect(addBook.error(f)).toHaveCount(0);
  });

  test('@FE-AC6 ISBN must be 13 digits', async ({ addBook }) => {
    await addBook.fillBook(newBookInput());
    for (const bad of ['978006112008', '97800611200845', '978006112008X']) {
      await addBook.isbn.fill(bad);
      await addBook.save.click();
      await expect(addBook.error('isbn'), bad).toHaveText('ISBN must be exactly 13 digits');
      await expect(addBook.isbn).toBeFocused();
    }
  });

  test('@FE-AC6 title must be 1–200 characters', async ({ addBook }) => {
    await addBook.fillBook(newBookInput({ title: 'x'.repeat(201) }));
    await addBook.save.click();
    await expect(addBook.error('title')).toHaveText('Title must be 200 characters or fewer');
    await expect(addBook.title).toBeFocused();

    await addBook.title.fill('   ');
    await addBook.save.click();
    await expect(addBook.error('title')).toHaveText('Title is required');
  });

  test('@FE-AC6 author must be 1–120 characters', async ({ addBook }) => {
    await addBook.fillBook(newBookInput({ author: 'a'.repeat(121) }));
    await addBook.save.click();
    await expect(addBook.error('author')).toHaveText('Author must be 120 characters or fewer');
    await expect(addBook.author).toBeFocused();
  });

  test('@FE-AC6 year must be between 1450 and the current year', async ({ addBook }) => {
    const message = `Enter a year between 1450 and ${String(CURRENT_YEAR)}`;
    await addBook.fillBook(newBookInput());
    for (const bad of ['1449', String(CURRENT_YEAR + 1), '0', 'abcd', '19.5']) {
      await addBook.year.fill(bad);
      await addBook.save.click();
      await expect(addBook.error('publishedYear'), bad).toHaveText(message);
      await expect(addBook.year).toBeFocused();
    }
  });

  test('@FE-AC6 genre is required', async ({ addBook }) => {
    await addBook.fill({ title: 'T', author: 'A', isbn: randomIsbn(), publishedYear: '2000' });
    await addBook.save.click();
    await expect(addBook.error('genre')).toHaveText('Choose a genre');
    await expect(addBook.genre).toBeFocused();
  });

  test('@FE-AC6 boundary values are accepted (200/120 chars, 1450, current year, hyphenated ISBN)', async ({ addBook, mockApi }) => {
    const isbn = randomIsbn();
    const hyphenated = `${isbn.slice(0, 3)}-${isbn.slice(3, 4)}-${isbn.slice(4, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`;
    await addBook.fill({ title: 'T'.repeat(200), author: 'A'.repeat(120), isbn: hyphenated, publishedYear: '1450', genre: 'HISTORY' });
    await addBook.save.click();
    await expect(addBook.page).toHaveURL(/#\/$/);
    const post = mockApi.requests.find((r) => r.method === 'POST');
    expect(post?.body).toEqual({ title: 'T'.repeat(200), author: 'A'.repeat(120), isbn, publishedYear: 1450, genre: 'HISTORY' });

    await addBook.goto();
    await addBook.fillBook(newBookInput({ publishedYear: CURRENT_YEAR }));
    await addBook.save.click();
    await expect(addBook.page).toHaveURL(/#\/$/);
  });

  test('@FE-AC6 multiple errors: focus goes to the first in form order', async ({ addBook }) => {
    await addBook.fill({ title: 'Ok', author: '', isbn: '123', publishedYear: '1200' });
    await addBook.save.click();
    await expect(addBook.author).toBeFocused();
    await expect(addBook.error('author')).toBeVisible();
    await expect(addBook.error('isbn')).toBeVisible();
    await expect(addBook.error('publishedYear')).toBeVisible();
    await expect(addBook.error('genre')).toBeVisible();
    await expect(addBook.error('title')).toHaveCount(0);
  });
});
