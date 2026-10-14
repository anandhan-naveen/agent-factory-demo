import { test, expect, BOOKS, bookUrl, expectJson, expectProblem, expectValidationError } from './support/fixtures';
import { CURRENT_YEAR, isbnWithBadChecksum, uniqueIsbn, uniqueIsbnEndingWith, validBookInput, type Book, type BookInput } from './support/data';
import { GENRES } from './support/contract';

test.describe('POST /api/books – happy path', () => {
  test('@BE-AC3 creates a book: 201, Location header, contract body, available true', async ({ request, books }) => {
    const input = validBookInput({ genre: 'NON_FICTION' });
    const res = await request.post(BOOKS, { data: input });
    const book = await expectJson<Book>(res, 201, 'Book');
    books.track(book.id);

    expect(book).toMatchObject({ ...input, available: true });
    expect(Number.isNaN(Date.parse(book.createdAt))).toBe(false);
    expect(res.headers().location).toMatch(new RegExp(`/api/books/${book.id}$`));

    const fetched = await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book');
    expect(fetched).toEqual(book);
  });

  test('@BE-AC3 @BE-AC9 rejects a client-supplied available flag on create', async ({ books }) => {
    // `available` is not part of BookInput (additionalProperties: false): new books start available.
    await expectProblem(await books.post({ ...validBookInput(), available: false }), 400);
  });

  for (const genre of GENRES) {
    test(`@BE-AC3 accepts genre ${genre}`, async ({ books }) => {
      const book = await books.create({ genre: genre as BookInput['genre'] });
      expect(book.genre).toBe(genre);
    });
  }

  const boundaries: [string, Partial<BookInput>][] = [
    ['title of 1 char', { title: 'X' }],
    ['title of 200 chars', { title: 'T'.repeat(200) }],
    ['author of 1 char', { author: 'A' }],
    ['author of 120 chars', { author: 'A'.repeat(120) }],
    ['publishedYear 1450', { publishedYear: 1450 }],
    [`publishedYear ${CURRENT_YEAR} (current year)`, { publishedYear: CURRENT_YEAR }],
  ];
  for (const [label, overrides] of boundaries) {
    test(`@BE-AC3 accepts boundary value: ${label}`, async ({ books }) => {
      const book = await books.create(overrides);
      expect(book).toMatchObject(overrides);
    });
  }

  test('@BE-AC3 accepts an ISBN whose check digit is 0', async ({ books }) => {
    const isbn = uniqueIsbnEndingWith(0);
    const book = await books.create({ isbn });
    expect(book.isbn).toBe(isbn);
  });
});

test.describe('POST /api/books – validation (400 problem+json)', () => {
  const invalid: [string, Record<string, unknown>, string][] = [
    ['empty title', { title: '' }, 'title'],
    ['blank title', { title: '   ' }, 'title'],
    ['title of 201 chars', { title: 'T'.repeat(201) }, 'title'],
    ['empty author', { author: '' }, 'author'],
    ['blank author', { author: ' \t ' }, 'author'],
    ['author of 121 chars', { author: 'A'.repeat(121) }, 'author'],
    ['ISBN with bad checksum', { isbn: isbnWithBadChecksum() }, 'isbn'],
    ['ISBN of 12 digits', { isbn: uniqueIsbn().slice(0, 12) }, 'isbn'],
    ['ISBN of 14 digits', { isbn: `${uniqueIsbn()}0` }, 'isbn'],
    ['ISBN with hyphens', { isbn: '978-0-306-40615-7' }, 'isbn'],
    ['ISBN with letters', { isbn: '978030640615X' }, 'isbn'],
    ['ISBN-10', { isbn: '0306406152' }, 'isbn'],
    ['empty ISBN', { isbn: '' }, 'isbn'],
    ['publishedYear 1449', { publishedYear: 1449 }, 'publishedYear'],
    ['publishedYear next year', { publishedYear: CURRENT_YEAR + 1 }, 'publishedYear'],
    ['publishedYear as a numeric string', { publishedYear: '1999' }, 'publishedYear'],
    ['publishedYear with a fraction', { publishedYear: 1999.7 }, 'publishedYear'],
    ['genre not in enum', { genre: 'POETRY' }, 'genre'],
    ['genre in lower case', { genre: 'fiction' }, 'genre'],
  ];
  for (const [label, overrides, field] of invalid) {
    test(`@BE-AC3 @BE-AC4 rejects ${label} with errors.${field}`, async ({ books }) => {
      await expectValidationError(await books.post({ ...validBookInput(), ...overrides }), [field]);
    });
  }

  for (const field of ['title', 'author', 'isbn', 'publishedYear', 'genre'] as const) {
    test(`@BE-AC3 @BE-AC4 rejects a body missing ${field}`, async ({ books }) => {
      const body = Object.fromEntries(Object.entries(validBookInput()).filter(([key]) => key !== field));
      await expectValidationError(await books.post(body), [field]);
    });
  }

  test('@BE-AC4 reports every invalid field at once', async ({ request }) => {
    const res = await request.post(BOOKS, {
      data: { title: '', author: '', isbn: '123', publishedYear: 1000, genre: 'FICTION' },
    });
    const problem = await expectValidationError(res, ['title', 'author', 'isbn', 'publishedYear']);
    expect(Object.keys(problem.errors ?? {})).not.toContain('genre');
  });

  test('@BE-AC4 an empty JSON object reports all required fields', async ({ request }) => {
    await expectValidationError(await request.post(BOOKS, { data: {} }), ['title', 'author', 'isbn', 'publishedYear', 'genre']);
  });

  test('@BE-AC4 a rejected book is not persisted', async ({ request }) => {
    const input = validBookInput({ publishedYear: CURRENT_YEAR + 1 });
    await expectValidationError(await request.post(BOOKS, { data: input }), ['publishedYear']);
    const list = await request.get(BOOKS, { params: { q: input.title } });
    expect(((await list.json()) as { totalItems: number }).totalItems).toBe(0);
  });
});

test.describe('POST /api/books – duplicates', () => {
  test('@BE-AC5 a duplicate ISBN returns 409 "Duplicate ISBN"', async ({ books }) => {
    const existing = await books.create();
    await expectProblem(await books.post(validBookInput({ isbn: existing.isbn })), 409, 'Duplicate ISBN');
  });

  test('@BE-AC5 the original book is untouched after a duplicate attempt', async ({ request, books }) => {
    const existing = await books.create();
    await expectProblem(await request.post(BOOKS, { data: validBookInput({ isbn: existing.isbn, title: 'Impostor' }) }), 409, 'Duplicate ISBN');
    expect(await expectJson<Book>(await request.get(bookUrl(existing.id)), 200, 'Book')).toEqual(existing);
  });
});
