import type { APIRequestContext, APIResponse } from '@playwright/test';
import { test, expect, BOOKS, bookUrl, expectNoLeak, expectProblem, expectValidationError } from './support/fixtures';
import { validBookInput, type Book } from './support/data';

const MALFORMED_IDS = ['not-a-uuid', '12345', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', "1' OR '1'='1"];

test.describe('Malformed ids', () => {
  for (const id of MALFORMED_IDS) {
    test(`@BE-AC6 GET with malformed id ${JSON.stringify(id)} returns 404, not 500`, async ({ request }) => {
      await expectProblem(await request.get(bookUrl(id)), 404, 'Book not found');
    });
  }

  const verbs: [string, (r: APIRequestContext, id: string) => Promise<APIResponse>][] = [
    ['PUT', (r, id) => r.put(bookUrl(id), { data: validBookInput() })],
    ['PATCH availability', (r, id) => r.patch(`${bookUrl(id)}/availability`, { data: { available: false } })],
    ['DELETE', (r, id) => r.delete(bookUrl(id))],
  ];
  for (const [verb, call] of verbs) {
    test(`@BE-AC6 ${verb} with a malformed id returns 404, not 500`, async ({ request }) => {
      await expectProblem(await call(request, 'not-a-uuid'), 404, 'Book not found');
    });
  }
});

test.describe('Unknown and malformed request bodies', () => {
  test('@BE-AC9 POST with an unknown field is rejected with 400', async ({ books }) => {
    await expectProblem(await books.post({ ...validBookInput(), subtitle: 'not in the contract' }), 400);
  });

  test('@BE-AC9 POST with a client-supplied id is rejected with 400', async ({ books }) => {
    await expectProblem(await books.post({ ...validBookInput(), id: '00000000-0000-0000-0000-000000000001' }), 400);
  });

  test('@BE-AC9 PUT with an unknown field is rejected with 400 and changes nothing', async ({ request, books }) => {
    const book = await books.create();
    await expectProblem(await request.put(bookUrl(book.id), { data: { ...validBookInput(), rating: 5 } }), 400);
    expect((await (await request.get(bookUrl(book.id))).json()) as Book).toEqual(book);
  });

  test('@BE-AC9 malformed JSON returns 400 problem+json without internals', async ({ request }) => {
    const res = await request.post(BOOKS, { data: '{"title": "Broken", ', headers: { 'Content-Type': 'application/json' } });
    await expectProblem(res, 400);
  });

  test('@BE-AC9 a wrong JSON type returns 400 problem+json without internals', async ({ request }) => {
    const res = await request.post(BOOKS, { data: { ...validBookInput(), publishedYear: 'nineteen-ninety' } });
    await expectProblem(res, 400);
  });

  test('@BE-AC9 a JSON array body returns 400 problem+json without internals', async ({ request }) => {
    await expectProblem(await request.post(BOOKS, { data: [validBookInput()] }), 400);
  });
});

test.describe('No internals in any error response', () => {
  test('@BE-AC9 every error class (400, 404, 409) is a clean problem+json', async ({ request, books }) => {
    const existing = await books.create();
    const errorResponses: [APIResponse, number][] = [
      [await request.get(BOOKS, { params: { size: 101 } }), 400],
      [await request.get(BOOKS, { params: { page: 'NaN' } }), 400],
      [await request.get(BOOKS, { params: { genre: 'java.lang.Object' } }), 400],
      [await request.post(BOOKS, { data: { ...validBookInput(), isbn: 'x' } }), 400],
      [await request.get(bookUrl('not-a-uuid')), 404],
      [await request.post(BOOKS, { data: validBookInput({ isbn: existing.isbn }) }), 409],
    ];
    for (const [res, status] of errorResponses) {
      const text = await res.text();
      expect(res.status(), text).toBe(status);
      expect(res.headers()['content-type']).toMatch(/^application\/problem\+json/);
      expectNoLeak(text);
      expect(text).not.toMatch(/"(trace|stackTrace|exception)"\s*:/);
    }
  });

  test('@BE-AC9 @BE-AC4 validation messages do not leak internals', async ({ request }) => {
    const problem = await expectValidationError(
      await request.post(BOOKS, { data: { title: '', author: '', isbn: '1', publishedYear: 1, genre: 'FICTION' } }),
      ['title', 'author', 'isbn', 'publishedYear'],
    );
    expectNoLeak(JSON.stringify(problem));
  });
});
