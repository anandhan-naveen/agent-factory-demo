import { describe, expect, it, vi } from 'vitest';
import { ApiError, HttpBooksApi, buildQueryString, isAbortError, parseProblem, type FetchLike } from './client';
import type { Book } from './types';

const BOOK: Book = {
  id: 'b1',
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441172719',
  publishedYear: 1965,
  genre: 'FICTION',
  available: true,
  createdAt: '2026-01-01T00:00:00Z',
};

function json(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

function setup(response: Response | (() => Promise<Response>)) {
  const fetchMock = vi.fn<FetchLike>(() => (typeof response === 'function' ? response() : Promise.resolve(response)));
  const api = new HttpBooksApi('http://api.test/', fetchMock);
  const call = (n = 0) => {
    const args = fetchMock.mock.calls[n];
    if (!args) throw new Error(`fetch call ${String(n)} not made`);
    return { url: args[0], init: args[1] ?? {} };
  };
  return { api, fetchMock, call };
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

describe('buildQueryString', () => {
  it('is empty when no filters are set', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ q: '   ' })).toBe('');
  });

  it('encodes every supported parameter', () => {
    expect(buildQueryString({ q: ' le guin ', genre: 'FICTION', available: false, page: 0, size: 100 })).toBe(
      '?q=le+guin&genre=FICTION&available=false&page=0&size=100',
    );
  });
});

describe('HttpBooksApi', () => {
  it('lists books with query, headers and abort signal', async () => {
    const page = { items: [BOOK], page: 0, size: 20, totalItems: 1, totalPages: 1 };
    const { api, call } = setup(json(page));
    const controller = new AbortController();
    await expect(api.listBooks({ q: 'dune', available: true }, controller.signal)).resolves.toEqual(page);
    const { url, init } = call();
    expect(url).toBe('http://api.test/api/books?q=dune&available=true');
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toEqual({ Accept: 'application/json, application/problem+json' });
    expect(api.mode).toBe('http');
  });

  it('gets a single book with an encoded id', async () => {
    const { api, call } = setup(json(BOOK));
    await expect(api.getBook('a/b')).resolves.toEqual(BOOK);
    expect(call().url).toBe('http://api.test/api/books/a%2Fb');
  });

  it('creates a book with a JSON body', async () => {
    const { api, call } = setup(json(BOOK, 201));
    const input = { title: BOOK.title, author: BOOK.author, isbn: BOOK.isbn, publishedYear: BOOK.publishedYear, genre: BOOK.genre };
    await expect(api.createBook(input)).resolves.toEqual(BOOK);
    const { url, init } = call();
    expect(url).toBe('http://api.test/api/books');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(typeof init.body === 'string' ? JSON.parse(init.body) : null).toEqual(input);
  });

  it('patches availability', async () => {
    const { api, call } = setup(json({ ...BOOK, available: false }));
    await expect(api.setAvailability('b1', false)).resolves.toMatchObject({ available: false });
    const { url, init } = call();
    expect(url).toBe('http://api.test/api/books/b1/availability');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"available":false}');
  });

  it('deletes a book (204, no body)', async () => {
    const { api, call } = setup(new Response(null, { status: 204 }));
    await expect(api.deleteBook('b1')).resolves.toBeUndefined();
    expect(call().init.method).toBe('DELETE');
  });

  it('maps a 400 problem+json to ApiError with field errors', async () => {
    const problem = { title: 'Validation failed', status: 400, detail: 'Fix the fields', errors: { isbn: 'Invalid ISBN', year: 5 } };
    const { api } = setup(json(problem, 400, 'application/problem+json'));
    const error = await catchError(api.createBook({ ...BOOK }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, title: 'Validation failed', message: 'Fix the fields', errors: { isbn: 'Invalid ISBN' } });
  });

  it('maps a 409 conflict', async () => {
    const { api } = setup(json({ title: 'A book with this ISBN already exists', status: 409 }, 409, 'application/problem+json'));
    const error = await catchError(api.createBook({ ...BOOK }));
    expect(error).toMatchObject({ status: 409, title: 'A book with this ISBN already exists', errors: {} });
  });

  it('maps a 404 on delete', async () => {
    const { api } = setup(json({ title: 'Not Found', status: 404 }, 404, 'application/problem+json'));
    await expect(api.deleteBook('missing')).rejects.toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('falls back to statusText for non-JSON errors', async () => {
    const { api } = setup(new Response('<html>oops</html>', { status: 502, statusText: 'Bad Gateway', headers: { 'Content-Type': 'text/html' } }));
    await expect(api.listBooks({})).rejects.toMatchObject({ status: 502, title: 'Bad Gateway', message: 'Bad Gateway' });
  });

  it('falls back to a generic title when the JSON body is unreadable', async () => {
    const { api } = setup(new Response('{not json', { status: 500, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.listBooks({})).rejects.toMatchObject({ status: 500, title: 'Request failed (500)' });
  });

  it('wraps network failures as status 0', async () => {
    const { api } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await catchError(api.listBooks({}));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, title: 'Network error' });
  });

  it('re-throws abort errors untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    const { api } = setup(() => Promise.reject(abort));
    await expect(api.listBooks({})).rejects.toBe(abort);
  });

  it('uses global fetch by default', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(BOOK));
    await new HttpBooksApi('https://x').getBook('b1');
    expect(spy).toHaveBeenCalledWith('https://x/api/books/b1', expect.anything());
  });
});

describe('parseProblem / isAbortError', () => {
  it('ignores non-object bodies and mistyped fields', () => {
    expect(parseProblem(null)).toEqual({});
    expect(parseProblem([1])).toEqual({});
    expect(parseProblem({ title: 1, type: 'about:blank', instance: '/x', status: '400' })).toEqual({ type: 'about:blank', instance: '/x' });
  });

  it('detects abort errors by name', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  it('ApiError defaults', () => {
    const error = new ApiError(500, 'Boom');
    expect(error.message).toBe('Boom');
    expect(error.errors).toEqual({});
    expect(error.name).toBe('ApiError');
  });
});
