import { test, expect, bookUrl, expectJson, expectProblem } from './support/fixtures';
import { unknownId, type Book } from './support/data';

const availabilityUrl = (id: string): string => `${bookUrl(id)}/availability`;

test.describe('PATCH /api/books/{id}/availability', () => {
  test('@BE-AC7 toggles available false then true and changes nothing else', async ({ request, books }) => {
    const book = await books.create();
    expect(book.available).toBe(true);

    const loaned = await expectJson<Book>(await request.patch(availabilityUrl(book.id), { data: { available: false } }), 200, 'Book');
    expect(loaned).toEqual({ ...book, available: false });
    expect(await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book')).toEqual(loaned);

    const returned = await expectJson<Book>(await request.patch(availabilityUrl(book.id), { data: { available: true } }), 200, 'Book');
    expect(returned).toEqual(book);
  });

  test('@BE-AC7 setting the same value is idempotent', async ({ request, books }) => {
    const book = await books.create();
    const res = await expectJson<Book>(await request.patch(availabilityUrl(book.id), { data: { available: true } }), 200, 'Book');
    expect(res).toEqual(book);
  });

  const badBodies: [string, unknown][] = [
    ['an empty object', {}],
    ['available: null', { available: null }],
    ['available as a non-boolean string', { available: 'maybe' }],
    ['available as a number', { available: 2 }],
    ['an extra editable field', { available: false, title: 'Sneaky rename' }],
  ];
  for (const [label, data] of badBodies) {
    test(`@BE-AC7 @BE-AC9 rejects ${label} with 400`, async ({ request, books }) => {
      const book = await books.create();
      await expectProblem(await request.patch(availabilityUrl(book.id), { data }), 400);
      expect(await expectJson<Book>(await request.get(bookUrl(book.id)), 200, 'Book')).toEqual(book);
    });
  }

  test('@BE-AC7 @BE-AC6 an unknown id returns 404 "Book not found"', async ({ request }) => {
    await expectProblem(await request.patch(availabilityUrl(unknownId()), { data: { available: false } }), 404, 'Book not found');
  });
});
