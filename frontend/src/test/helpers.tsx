import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { BooksApi } from '../api/client';
import { DemoBooksApi } from '../api/demoApi';
import { App } from '../App';

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export function demoApi(storage: Storage | null = new MemoryStorage()): DemoBooksApi {
  return new DemoBooksApi({ storage, latencyMs: 0 });
}

/** A BooksApi backed by a fast demo instance, with selected methods overridden. */
export function stubApi(overrides: Partial<BooksApi> = {}, base: DemoBooksApi = demoApi()): BooksApi {
  return {
    mode: base.mode,
    listBooks: (query, signal) => base.listBooks(query, signal),
    getBook: (id, signal) => base.getBook(id, signal),
    createBook: (input, signal) => base.createBook(input, signal),
    setAvailability: (id, available, signal) => base.setAvailability(id, available, signal),
    deleteBook: (id, signal) => base.deleteBook(id, signal),
    ...overrides,
  };
}

export function renderApp(api: BooksApi, route = '/') {
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <App api={api} />
    </MemoryRouter>,
  );
  return { user, ...utils };
}
