import { test, expect, BOOKS, bookUrl, expectJson, expectProblem, expectValidationError } from './support/fixtures';
import { CURRENT_YEAR, isbnWithBadChecksum, uniqueIsbn, unknownId, validBookInput, type Book } from './support/data';

test.describe('GET /api/books/{id}', () => {
  test('@BE-AC6 returns an existing book', async ({ request, books }) => {
    const book = await books.create();
    expect(await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book')).toEqual(book);
  });

  test('@BE-AC6 an unknown id returns 404 "Book not found"', async ({ request }) => {
    await expectProblem(await request.get(bookUrl(unknownId())), 404, 'Book not found');
  });
});

test.describe('PUT /api/books/{id}', () => {
  test('@BE-AC7 replaces all editable fields and keeps id, createdAt and available', async ({ request, books }) => {
    const book = await books.create({ genre: 'FICTION', publishedYear: 1999 });
    const replacement = validBookInput({ title: 'Replaced title', author: 'Replaced Author', publishedYear: 2020, genre: 'HISTORY' });

    const updated = await expectJson<Book>(await request.put(bookUrl(book.id), { data: replacement }), 200, 'Book');
    expect(updated).toEqual({ ...replacement, id: book.id, createdAt: book.createdAt, available: book.available });
    expect(await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book')).toEqual(updated);
  });

  test('@BE-AC7 PUT does not change availability', async ({ request, books }) => {
    const book = await books.create();
    expect((await request.patch(`${bookUrl(book.id)}/availability`, { data: { available: false } })).status()).toBe(200);
    const updated = await expectJson<Book>(await request.put(bookUrl(book.id), { data: validBookInput({ isbn: book.isbn }) }), 200, 'Book');
    expect(updated.available).toBe(false);
  });

  test('@BE-AC7 keeping the same ISBN is not a duplicate', async ({ request, books }) => {
    const book = await books.create();
    const updated = await expectJson<Book>(
      await request.put(bookUrl(book.id), { data: validBookInput({ isbn: book.isbn, title: 'Same ISBN, new title' }) }),
      200,
      'Book',
    );
    expect(updated).toMatchObject({ isbn: book.isbn, title: 'Same ISBN, new title' });
  });

  const invalid: [string, Record<string, unknown>, string][] = [
    ['blank title', { title: '  ' }, 'title'],
    ['title of 201 chars', { title: 'x'.repeat(201) }, 'title'],
    ['author of 121 chars', { author: 'x'.repeat(121) }, 'author'],
    ['ISBN with bad checksum', { isbn: isbnWithBadChecksum() }, 'isbn'],
    ['publishedYear next year', { publishedYear: CURRENT_YEAR + 1 }, 'publishedYear'],
    ['publishedYear 1449', { publishedYear: 1449 }, 'publishedYear'],
    ['unknown genre', { genre: 'POETRY' }, 'genre'],
  ];
  for (const [label, overrides, field] of invalid) {
    test(`@BE-AC7 @BE-AC4 applies the same validation as create: ${label}`, async ({ request, books }) => {
      const book = await books.create();
      await expectValidationError(await request.put(bookUrl(book.id), { data: { ...validBookInput(), ...overrides } }), [field]);
      expect(await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book')).toEqual(book);
    });
  }

  test('@BE-AC7 @BE-AC4 is a full replace: a missing field is a validation error', async ({ request, books }) => {
    const book = await books.create();
    const partial = { title: 'Only a title' };
    await expectValidationError(await request.put(bookUrl(book.id), { data: partial }), ['author', 'isbn', 'publishedYear', 'genre']);
  });

  test("@BE-AC7 @BE-AC5 taking another book's ISBN returns 409 \"Duplicate ISBN\"", async ({ request, books }) => {
    const first = await books.create();
    const second = await books.create();
    await expectProblem(await request.put(bookUrl(second.id), { data: validBookInput({ isbn: first.isbn }) }), 409, 'Duplicate ISBN');
    expect(await expectJson<Book>(await request.get(bookUrl(second.id)), 200, 'Book')).toEqual(second);
  });

  test('@BE-AC7 @BE-AC6 an unknown id returns 404 "Book not found"', async ({ request }) => {
    await expectProblem(await request.put(bookUrl(unknownId()), { data: validBookInput() }), 404, 'Book not found');
  });
});

test.describe('DELETE /api/books/{id}', () => {
  test('@BE-AC8 returns 204 with no body, then GET returns 404', async ({ request, books }) => {
    const book = await books.create();
    const res = await request.delete(bookUrl(book.id));
    expect(res.status()).toBe(204);
    expect((await res.body()).length).toBe(0);
    await expectProblem(await request.get(bookUrl(book.id)), 404, 'Book not found');
  });

  test('@BE-AC8 the deleted book disappears from the list', async ({ request, books }) => {
    const book = await books.create();
    expect((await request.delete(bookUrl(book.id))).status()).toBe(204);
    const page = (await (await request.get(BOOKS, { params: { q: book.title } })).json()) as { totalItems: number };
    expect(page.totalItems).toBe(0);
  });

  test('@BE-AC8 deleting twice returns 404 the second time', async ({ request, books }) => {
    const book = await books.create();
    expect((await request.delete(bookUrl(book.id))).status()).toBe(204);
    await expectProblem(await request.delete(bookUrl(book.id)), 404, 'Book not found');
  });

  test('@BE-AC8 the ISBN of a deleted book can be reused', async ({ request, books }) => {
    const isbn = uniqueIsbn();
    const book = await books.create({ isbn });
    expect((await request.delete(bookUrl(book.id))).status()).toBe(204);
    const again = await books.create({ isbn });
    expect(again.id).not.toBe(book.id);
  });

  test('@BE-AC8 @BE-AC6 an unknown id returns 404 "Book not found"', async ({ request }) => {
    await expectProblem(await request.delete(bookUrl(unknownId())), 404, 'Book not found');
  });
});
