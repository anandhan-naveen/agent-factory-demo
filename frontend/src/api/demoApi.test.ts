import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../test/helpers';
import { ApiError } from './client';
import { DEMO_STORAGE_KEY, DemoBooksApi, seedBooks } from './demoApi';
import { createBooksApi } from './index';
import type { BookInput } from './types';

const NEW_BOOK: BookInput = {
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441172719',
  publishedYear: 1965,
  genre: 'FICTION',
};

function make(storage: Storage | null = new MemoryStorage()) {
  let n = 0;
  const api = new DemoBooksApi({
    storage,
    latencyMs: 0,
    now: () => new Date('2026-06-01T10:00:00Z'),
    idFactory: () => `id-${String(++n)}`,
  });
  return { api, storage };
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected rejection');
}

describe('DemoBooksApi', () => {
  it('seeds 8 books with valid data and persists them', async () => {
    const { api, storage } = make();
    const page = await api.listBooks({ size: 100 });
    expect(page.totalItems).toBe(8);
    expect(api.mode).toBe('demo');
    expect(JSON.parse(storage?.getItem(DEMO_STORAGE_KEY) ?? '[]')).toHaveLength(8);
    expect(new Set(seedBooks().map((b) => b.genre)).size).toBe(6);
  });

  it('sorts by title and paginates', async () => {
    const { api } = make();
    const all = await api.listBooks({ size: 100 });
    const titles = all.items.map((b) => b.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    const page1 = await api.listBooks({ page: 1, size: 3 });
    expect(page1).toMatchObject({ page: 1, size: 3, totalItems: 8, totalPages: 3 });
    expect(page1.items.map((b) => b.title)).toEqual(titles.slice(3, 6));
    expect((await api.listBooks({})).size).toBe(20);
  });

  it('searches title or author case-insensitively', async () => {
    const { api } = make();
    expect((await api.listBooks({ q: 'MOCKING' })).items.map((b) => b.title)).toEqual(['To Kill a Mockingbird']);
    expect((await api.listBooks({ q: 'le guin' })).items.map((b) => b.author)).toEqual(['Ursula K. Le Guin']);
  });

  it('combines genre, availability and search filters', async () => {
    const { api } = make();
    expect((await api.listBooks({ genre: 'SCIENCE' })).totalItems).toBe(2);
    expect((await api.listBooks({ available: false })).totalItems).toBe(2);
    expect((await api.listBooks({ genre: 'TECHNOLOGY', available: true })).totalItems).toBe(0);
    expect((await api.listBooks({ q: 'TIME', genre: 'SCIENCE' })).items.map((b) => b.title)).toEqual(['A Brief History of Time']);
  });

  it('rejects out-of-range query parameters with 400', async () => {
    const { api } = make();
    expect((await catchError(api.listBooks({ size: 101 }))).status).toBe(400);
    // R-FE-13: a negative page is reported under `page`, not `size`.
    const negativePage = await catchError(api.listBooks({ page: -1 }));
    expect(negativePage.status).toBe(400);
    expect(negativePage.errors).toEqual({ page: 'Page must be 0 or greater' });
    expect((await catchError(api.listBooks({ page: -1, size: 0 }))).errors).toEqual({
      page: 'Page must be 0 or greater',
      size: 'Size must be between 1 and 100',
    });
    expect((await catchError(api.listBooks({ q: 'x'.repeat(201) }))).errors).toHaveProperty('q');
  });

  it('creates an available book and persists it across instances', async () => {
    const { api, storage } = make();
    const created = await api.createBook({ ...NEW_BOOK, title: '  Dune  ', isbn: '978-0441172719' });
    expect(created).toEqual({ ...NEW_BOOK, id: 'id-1', available: true, createdAt: '2026-06-01T10:00:00.000Z' });
    const reloaded = new DemoBooksApi({ storage, latencyMs: 0 });
    expect((await reloaded.getBook('id-1')).title).toBe('Dune');
    expect((await reloaded.listBooks({})).totalItems).toBe(9);
  });

  it('applies the backend validation rules (400)', async () => {
    const { api } = make();
    const error = await catchError(api.createBook({ ...NEW_BOOK, title: '', isbn: '9780441172710', publishedYear: 2027 }));
    expect(error.status).toBe(400);
    expect(Object.keys(error.errors).sort((a, b) => a.localeCompare(b))).toEqual(['isbn', 'publishedYear', 'title']);
  });

  it('rejects a duplicate ISBN with 409', async () => {
    const { api } = make();
    const error = await catchError(api.createBook({ ...NEW_BOOK, isbn: '978-0-06-112008-4' }));
    expect(error.status).toBe(409);
    expect(error.errors.isbn).toBe('A book with this ISBN already exists');
  });

  it('updates availability and returns 404 for unknown ids', async () => {
    const { api } = make();
    const [first] = (await api.listBooks({})).items;
    if (!first) throw new Error('no seed');
    const updated = await api.setAvailability(first.id, !first.available);
    expect(updated.available).toBe(!first.available);
    expect((await api.getBook(first.id)).available).toBe(!first.available);
    expect((await catchError(api.setAvailability('nope', true))).status).toBe(404);
    expect((await catchError(api.getBook('nope'))).status).toBe(404);
  });

  it('deletes books and returns 404 for unknown ids', async () => {
    const { api } = make();
    const [first] = (await api.listBooks({})).items;
    if (!first) throw new Error('no seed');
    await api.deleteBook(first.id);
    expect((await api.listBooks({})).totalItems).toBe(7);
    expect((await catchError(api.deleteBook(first.id))).status).toBe(404);
    api.reset();
    expect((await api.listBooks({})).totalItems).toBe(8);
  });

  it('falls back to the seed when storage is corrupt or invalid', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{oops');
    expect((await make(storage).api.listBooks({})).totalItems).toBe(8);
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify([{ id: 1 }]));
    expect((await make(storage).api.listBooks({})).totalItems).toBe(8);
  });

  it('keeps working when storage is unavailable or full', async () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    const { api } = make(storage);
    await api.createBook(NEW_BOOK);
    expect((await api.listBooks({})).totalItems).toBe(9);
    expect((await make(null).api.listBooks({})).totalItems).toBe(8);
  });

  it('uses window.localStorage and random ids by default', async () => {
    const api = new DemoBooksApi({ latencyMs: 0 });
    const created = await api.createBook(NEW_BOOK);
    expect(created.id).toMatch(/[0-9a-f-]{36}|^demo-/);
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toContain('Dune');
  });

  it('honours AbortSignal during simulated latency', async () => {
    const api = new DemoBooksApi({ storage: null, latencyMs: 50 });
    const controller = new AbortController();
    const pending = api.listBooks({}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(api.listBooks({}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(api.listBooks({}, new AbortController().signal)).resolves.toMatchObject({ totalItems: 8 });
  });
});

describe('createBooksApi', () => {
  it('uses the HTTP client when a base URL is set', () => {
    expect(createBooksApi('http://localhost:8080').mode).toBe('http');
  });

  it('falls back to demo mode when the base URL is empty', () => {
    expect(createBooksApi('  ').mode).toBe('demo');
    expect(createBooksApi().mode).toBe('demo');
  });
});
