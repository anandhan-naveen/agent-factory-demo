import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BooksApi } from '../api/client';
import type { Book, BookPage, BookQuery } from '../api/types';
import { stubApi } from '../test/helpers';
import { CATALOG_PAGE_SIZE, useBooks, type BooksFilter } from './useBooks';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function book(id: string, title: string): Book {
  return { id, title, author: 'A', isbn: '9780000000002', publishedYear: 2000, genre: 'FICTION', available: true, createdAt: '2026-01-01T00:00:00Z' };
}

function pageOf(items: Book[], totalItems = items.length): BookPage {
  return { items, page: 0, size: CATALOG_PAGE_SIZE, totalItems, totalPages: Math.ceil(totalItems / CATALOG_PAGE_SIZE) };
}

/** listBooks that hands every call to the test as a pending deferred. */
function controlledList() {
  const calls: { query: BookQuery; signal: AbortSignal | undefined; reply: Deferred<BookPage> }[] = [];
  const api: BooksApi = stubApi({
    listBooks: (query, signal) => {
      const reply = deferred<BookPage>();
      calls.push({ query, signal, reply });
      return reply.promise;
    },
  });
  return { api, calls };
}

function call<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no call #${String(index)}`);
  return item;
}

describe('useBooks', () => {
  it('R-FE-07: aborts a superseded query and ignores its late response', async () => {
    const { api, calls } = controlledList();
    const { result, rerender } = renderHook(({ filter }: { filter: BooksFilter }) => useBooks(api, filter), {
      initialProps: { filter: { q: 'a' } },
    });
    expect(calls).toHaveLength(1);
    rerender({ filter: { q: 'b' } });
    expect(calls).toHaveLength(2);
    const a = call(calls, 0);
    const b = call(calls, 1);
    expect(a.signal?.aborted).toBe(true);
    expect(b.signal?.aborted).toBe(false);

    await act(async () => {
      b.reply.resolve(pageOf([book('b1', 'Book B')]));
      await b.reply.promise;
    });
    await act(async () => {
      a.reply.resolve(pageOf([book('a1', 'Book A')]));
      await a.reply.promise;
    });
    expect(result.current.books?.map((x) => x.title)).toEqual(['Book B']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('R-FE-07: ignores a late failure of a superseded query', async () => {
    const { api, calls } = controlledList();
    const { result, rerender } = renderHook(({ filter }: { filter: BooksFilter }) => useBooks(api, filter), {
      initialProps: { filter: { q: 'a' } },
    });
    rerender({ filter: { q: 'b' } });
    await act(async () => {
      call(calls, 1).reply.resolve(pageOf([book('b1', 'Book B')]));
      call(calls, 0).reply.reject(new Error('late failure'));
      await Promise.allSettled([call(calls, 0).reply.promise, call(calls, 1).reply.promise]);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.books?.map((x) => x.title)).toEqual(['Book B']);
  });

  it('R-FE-06: reloads instead of applying a list response that started before a local mutation', async () => {
    const { api, calls } = controlledList();
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf([book('x', 'X')]));
      await call(calls, 0).reply.promise;
    });
    act(() => {
      result.current.reload();
    });
    expect(calls).toHaveLength(2);
    // The toggle lands while the reload is in flight.
    act(() => {
      result.current.replaceBook({ ...book('x', 'X'), available: false });
    });
    await act(async () => {
      call(calls, 1).reply.resolve(pageOf([book('x', 'X')])); // stale snapshot: still available
      await call(calls, 1).reply.promise;
    });
    expect(calls).toHaveLength(3);
    expect(result.current.books?.[0]?.available).toBe(false);
    await act(async () => {
      call(calls, 2).reply.resolve(pageOf([{ ...book('x', 'X'), available: false }]));
      await call(calls, 2).reply.promise;
    });
    expect(calls).toHaveLength(3);
    expect(result.current.books?.[0]?.available).toBe(false);
  });

  it('R-FE-01: tracks totalItems and appends the next page on loadMore', async () => {
    const { api, calls } = controlledList();
    const first = Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const last = book('id-100', 'T100');
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(first, 101));
      await call(calls, 0).reply.promise;
    });
    expect(result.current.totalItems).toBe(101);
    expect(result.current.hasMore).toBe(true);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(true);
    expect(call(calls, 1).query).toMatchObject({ page: 1, size: CATALOG_PAGE_SIZE });
    await act(async () => {
      call(calls, 1).reply.resolve({ ...pageOf([last], 101), page: 1 });
      await pending;
    });
    expect(result.current.books).toHaveLength(101);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  it('R-FE-01: after a local delete, loadMore re-reads the shifted page and merges by id', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 101 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 101));
      await call(calls, 0).reply.promise;
    });
    act(() => {
      result.current.removeBook('id-5');
    });
    expect(result.current.totalItems).toBe(100);
    expect(result.current.hasMore).toBe(true);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    // 99 loaded: page 0 again, which now ends with the book that used to be at offset 100.
    expect(call(calls, 1).query).toMatchObject({ page: 0 });
    const remaining = all.filter((b) => b.id !== 'id-5');
    await act(async () => {
      call(calls, 1).reply.resolve(pageOf(remaining.slice(0, 100), 100));
      await pending;
    });
    expect(result.current.books).toHaveLength(100);
    expect(new Set(result.current.books?.map((b) => b.id)).size).toBe(100);
    expect(result.current.books?.some((b) => b.id === 'id-100')).toBe(true);
    expect(result.current.hasMore).toBe(false);
  });

  it('R-FE-01: loadMore drops books deleted while it was in flight, and is a no-op while already loading', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 101 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 101));
      await call(calls, 0).reply.promise;
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    await act(async () => {
      await result.current.loadMore();
    });
    expect(calls).toHaveLength(2);
    act(() => {
      result.current.removeBook('id-100');
    });
    await act(async () => {
      call(calls, 1).reply.resolve({ ...pageOf([call(all, 100)], 101), page: 1 });
      await pending;
    });
    expect(result.current.books?.some((b) => b.id === 'id-100')).toBe(false);
  });

  it('R2-FE-02: loadMore is a no-op while page 0 of a new filter is loading, then pages from the new list', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 150 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result, rerender } = renderHook(({ filter }: { filter: BooksFilter }) => useBooks(api, filter), {
      initialProps: { filter: { q: '' } },
    });
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 150));
      await call(calls, 0).reply.promise;
    });
    rerender({ filter: { q: 'x' } });
    expect(result.current.loading).toBe(true);
    expect(calls).toHaveLength(2);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(calls).toHaveLength(2);
    expect(result.current.loadingMore).toBe(false);

    const matches = all.slice(0, 120);
    await act(async () => {
      call(calls, 1).reply.resolve(pageOf(matches.slice(0, 100), 120));
      await call(calls, 1).reply.promise;
    });
    expect(result.current.totalItems).toBe(120);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    expect(call(calls, 2).query).toMatchObject({ q: 'x', page: 1 });
    await act(async () => {
      call(calls, 2).reply.resolve({ ...pageOf(matches.slice(100), 120), page: 1 });
      await pending;
    });
    expect(result.current.books?.map((b) => b.id)).toEqual(matches.map((b) => b.id));
    expect(result.current.hasMore).toBe(false);
  });

  it('R2-FE-02: a reload aborts an in-flight loadMore, whose late response is ignored', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 101 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 101));
      await call(calls, 0).reply.promise;
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    act(() => {
      result.current.reload();
    });
    expect(call(calls, 1).signal?.aborted).toBe(true);
    expect(result.current.loadingMore).toBe(false);
    await act(async () => {
      call(calls, 1).reply.resolve({ ...pageOf([call(all, 100)], 101), page: 1 });
      await pending;
    });
    expect(result.current.books).toHaveLength(100);
    await act(async () => {
      call(calls, 2).reply.resolve(pageOf(all.slice(0, 100), 101));
      await call(calls, 2).reply.promise;
    });
    expect(result.current.books).toHaveLength(100);
    expect(result.current.hasMore).toBe(true);
  });

  it('R2-FE-02: loadMore keeps the local totalItems when a delete lands while it is in flight', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 102 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result } = renderHook(() => useBooks(api, { q: '' }));
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 102));
      await call(calls, 0).reply.promise;
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore();
    });
    act(() => {
      result.current.removeBook('id-3');
    });
    expect(result.current.totalItems).toBe(101);
    // The server's snapshot predates the delete and still counts 102.
    await act(async () => {
      call(calls, 1).reply.resolve({ ...pageOf(all.slice(100), 102), page: 1 });
      await pending;
    });
    expect(result.current.books).toHaveLength(101);
    expect(result.current.totalItems).toBe(101);
    expect(result.current.hasMore).toBe(false);
  });

  it('R-FE-01: a loadMore failure is rethrown; a filter change aborts it silently', async () => {
    const { api, calls } = controlledList();
    const all = Array.from({ length: 101 }, (_, i) => book(`id-${String(i)}`, `T${String(i)}`));
    const { result, rerender } = renderHook(({ filter }: { filter: BooksFilter }) => useBooks(api, filter), {
      initialProps: { filter: { q: '' } },
    });
    await act(async () => {
      call(calls, 0).reply.resolve(pageOf(all.slice(0, 100), 101));
      await call(calls, 0).reply.promise;
    });

    let failing!: Promise<void>;
    act(() => {
      failing = result.current.loadMore();
    });
    call(calls, 1).reply.reject(new Error('boom'));
    await act(async () => {
      await expect(failing).rejects.toThrow('boom');
    });
    expect(result.current.loadingMore).toBe(false);

    let aborted!: Promise<void>;
    act(() => {
      aborted = result.current.loadMore();
    });
    rerender({ filter: { q: 'x' } });
    expect(call(calls, 2).signal?.aborted).toBe(true);
    call(calls, 2).reply.reject(new DOMException('aborted', 'AbortError'));
    await act(async () => {
      await expect(aborted).resolves.toBeUndefined();
    });
    expect(result.current.loadingMore).toBe(false);
    await waitFor(() => {
      expect(calls).toHaveLength(4);
    });
  });
});
