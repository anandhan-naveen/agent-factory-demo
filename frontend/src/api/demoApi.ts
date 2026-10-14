import { ApiError, type BooksApi } from './client';
import { isGenre, type Book, type BookInput, type BookPage, type BookQuery } from './types';
import { DUPLICATE_ISBN_MESSAGE, hasErrors, normalizeIsbn, validateBook } from '../domain/validation';

export const DEMO_STORAGE_KEY = 'library.demo.v1';

type SeedBook = Omit<Book, 'createdAt'>;

const SEED: readonly SeedBook[] = [
  { id: '6f1c2a3e-0001-4a51-9a0e-1d2f3c4b5a01', title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', publishedYear: 1960, genre: 'FICTION', available: true },
  { id: '6f1c2a3e-0002-4a51-9a0e-1d2f3c4b5a02', title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', isbn: '9780062316097', publishedYear: 2011, genre: 'NON_FICTION', available: false },
  { id: '6f1c2a3e-0003-4a51-9a0e-1d2f3c4b5a03', title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', publishedYear: 1988, genre: 'SCIENCE', available: true },
  { id: '6f1c2a3e-0004-4a51-9a0e-1d2f3c4b5a04', title: 'The Guns of August', author: 'Barbara W. Tuchman', isbn: '9780345476098', publishedYear: 1962, genre: 'HISTORY', available: true },
  { id: '6f1c2a3e-0005-4a51-9a0e-1d2f3c4b5a05', title: 'The Pragmatic Programmer', author: 'Andrew Hunt and David Thomas', isbn: '9780135957059', publishedYear: 2019, genre: 'TECHNOLOGY', available: false },
  { id: '6f1c2a3e-0006-4a51-9a0e-1d2f3c4b5a06', title: 'Where the Wild Things Are', author: 'Maurice Sendak', isbn: '9780060254926', publishedYear: 1963, genre: 'CHILDREN', available: true },
  { id: '6f1c2a3e-0007-4a51-9a0e-1d2f3c4b5a07', title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', isbn: '9780441478125', publishedYear: 1969, genre: 'FICTION', available: true },
  { id: '6f1c2a3e-0008-4a51-9a0e-1d2f3c4b5a08', title: 'The Gene: An Intimate History', author: 'Siddhartha Mukherjee', isbn: '9781476733500', publishedYear: 2016, genre: 'SCIENCE', available: true },
];

export function seedBooks(): Book[] {
  const base = Date.UTC(2026, 0, 5, 9, 0, 0);
  return SEED.map((book, index) => ({ ...book, createdAt: new Date(base + index * 86_400_000).toISOString() }));
}

function isBook(value: unknown): value is Book {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.author === 'string' &&
    typeof v.isbn === 'string' &&
    typeof v.publishedYear === 'number' &&
    isGenre(v.genre) &&
    typeof v.available === 'boolean' &&
    typeof v.createdAt === 'string'
  );
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // eslint-disable-next-line sonarjs/pseudo-random -- demo-mode record id fallback only; not a security token.
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface DemoOptions {
  storage?: Storage | null;
  /** Simulated network latency in ms (default 250). */
  latencyMs?: number;
  now?: () => Date;
  idFactory?: () => string;
}

/**
 * In-browser implementation of the Books API used when no backend is configured.
 * Applies the same validation and conflict rules as the backend contract.
 */
export class DemoBooksApi implements BooksApi {
  readonly mode = 'demo' as const;
  private books: Book[];
  private readonly storage: Storage | null;
  private readonly latencyMs: number;
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  constructor(options: DemoOptions = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.latencyMs = options.latencyMs ?? 250;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? defaultId;
    this.books = this.load();
  }

  private load(): Book[] {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(isBook)) return parsed;
      }
    } catch {
      // Corrupt or unavailable storage: fall back to the seed.
    }
    const seeded = seedBooks();
    this.persist(seeded);
    return seeded;
  }

  private persist(books: Book[]): void {
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(books));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }

  private find(id: string): Book {
    const book = this.books.find((b) => b.id === id);
    if (!book) throw new ApiError(404, 'Book not found', {}, `No book with id ${id}`);
    return book;
  }

  async listBooks(query: BookQuery, signal?: AbortSignal): Promise<BookPage> {
    await wait(this.latencyMs, signal);
    const q = query.q?.trim().toLowerCase() ?? '';
    if (q.length > 200) throw new ApiError(400, 'Validation failed', { q: 'Search must be 200 characters or fewer' });
    const page = query.page ?? 0;
    const size = query.size ?? 20;
    const paging: Record<string, string> = {};
    if (page < 0) paging.page = 'Page must be 0 or greater';
    if (size < 1 || size > 100) paging.size = 'Size must be between 1 and 100';
    if (Object.keys(paging).length > 0) throw new ApiError(400, 'Validation failed', paging);

    const matches = this.books
      .filter((b) => q === '' || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .filter((b) => query.genre === undefined || b.genre === query.genre)
      .filter((b) => query.available === undefined || b.available === query.available)
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    return {
      items: matches.slice(page * size, page * size + size),
      page,
      size,
      totalItems: matches.length,
      totalPages: Math.ceil(matches.length / size),
    };
  }

  async getBook(id: string, signal?: AbortSignal): Promise<Book> {
    await wait(this.latencyMs, signal);
    return { ...this.find(id) };
  }

  async createBook(input: BookInput, signal?: AbortSignal): Promise<Book> {
    await wait(this.latencyMs, signal);
    const errors = validateBook(input, this.now());
    if (hasErrors(errors)) throw new ApiError(400, 'Validation failed', errors);
    const isbn = normalizeIsbn(input.isbn);
    if (this.books.some((b) => b.isbn === isbn)) {
      throw new ApiError(409, DUPLICATE_ISBN_MESSAGE, { isbn: DUPLICATE_ISBN_MESSAGE });
    }
    const book: Book = {
      id: this.idFactory(),
      title: input.title.trim(),
      author: input.author.trim(),
      isbn,
      publishedYear: input.publishedYear,
      genre: input.genre,
      available: true,
      createdAt: this.now().toISOString(),
    };
    this.books = [...this.books, book];
    this.persist(this.books);
    return { ...book };
  }

  async setAvailability(id: string, available: boolean, signal?: AbortSignal): Promise<Book> {
    await wait(this.latencyMs, signal);
    const updated: Book = { ...this.find(id), available };
    this.books = this.books.map((b) => (b.id === id ? updated : b));
    this.persist(this.books);
    return { ...updated };
  }

  async deleteBook(id: string, signal?: AbortSignal): Promise<void> {
    await wait(this.latencyMs, signal);
    this.find(id);
    this.books = this.books.filter((b) => b.id !== id);
    this.persist(this.books);
  }

  /** Restores the seed data (handy for manual testing). */
  reset(): void {
    this.books = seedBooks();
    this.persist(this.books);
  }
}
