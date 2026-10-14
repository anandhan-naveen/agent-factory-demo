import { test as base, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { schemaErrors, type SchemaName } from './contract';
import { validBookInput, type Book, type BookInput, type Problem } from './data';

export { expect };

export const BOOKS = '/api/books';
export const bookUrl = (id: string): string => `${BOOKS}/${encodeURIComponent(id)}`;

const LEAK_PATTERNS = [/trace/i, /exception/i, /java\./i, /\bat [\w$.]+\(/, /springframework/i, /hibernate/i, /jackson/i];

/** BE-AC9: error bodies must not reveal stack traces or internal class names. */
export function expectNoLeak(text: string): void {
  for (const pattern of LEAK_PATTERNS) {
    expect(text, `error body leaks internals (${pattern.source})`).not.toMatch(pattern);
  }
}

export function expectSchema(name: SchemaName, body: unknown): void {
  expect(schemaErrors(name, body), `${name} does not match openapi.yaml`).toBeNull();
}

export async function expectJson<T>(res: APIResponse, status: number, schemaName: SchemaName): Promise<T> {
  expect(res.status(), await res.text()).toBe(status);
  expect(res.headers()['content-type']).toMatch(/^application\/json/);
  const body = (await res.json()) as T;
  expectSchema(schemaName, body);
  return body;
}

/** RFC 7807 problem: status, content-type, schema, `status` field, `title`, and no leaked internals. */
export async function expectProblem(res: APIResponse, status: number, title?: string): Promise<Problem> {
  const text = await res.text();
  expect(res.status(), text).toBe(status);
  expect(res.headers()['content-type']).toMatch(/^application\/problem\+json/);
  const body = JSON.parse(text) as Problem;
  expectSchema('Problem', body);
  expect(body.status).toBe(status);
  if (title !== undefined) expect(body.title).toBe(title);
  expectNoLeak(text);
  return body;
}

/** BE-AC4: 400 "Validation failed" with an `errors` entry (non-empty message) for each field. */
export async function expectValidationError(res: APIResponse, fields: string[]): Promise<Problem> {
  const body = await expectProblem(res, 400, 'Validation failed');
  expect(body.errors, 'problem has an errors object').toBeDefined();
  const errors = body.errors ?? {};
  for (const field of fields) {
    expect(Object.keys(errors), `errors should include "${field}"`).toContain(field);
    expect(errors[field]?.trim().length ?? 0, `message for "${field}"`).toBeGreaterThan(0);
  }
  return body;
}

export interface BookFactory {
  /** POST a valid book (with overrides); asserts 201 and registers it for cleanup. */
  create(overrides?: Partial<BookInput>): Promise<Book>;
  /** POST an arbitrary body; if the server (wrongly) creates a book, it is still cleaned up. */
  post(data: unknown): Promise<APIResponse>;
  /** Register an id created some other way so it is deleted after the test. */
  track(id: string): void;
}

async function deleteQuietly(request: APIRequestContext, id: string): Promise<void> {
  const res = await request.delete(bookUrl(id));
  if (![204, 404].includes(res.status())) {
    throw new Error(`cleanup of ${id} failed: ${res.status()} ${await res.text()}`);
  }
}

export const test = base.extend<{ books: BookFactory }>({
  books: async ({ request }, use) => {
    const created = new Set<string>();
    await use({
      async create(overrides = {}) {
        const res = await request.post(BOOKS, { data: validBookInput(overrides) });
        const book = await expectJson<Book>(res, 201, 'Book');
        created.add(book.id);
        return book;
      },
      async post(data) {
        const res = await request.post(BOOKS, { data });
        if (res.status() === 201) {
          const body = (await res.json()) as Partial<Book>;
          if (body.id) created.add(body.id);
        }
        return res;
      },
      track(id) {
        created.add(id);
      },
    });
    // afterEach: remove everything this test created, so tests are independent and re-runnable.
    for (const id of created) await deleteQuietly(request, id);
  },
});
