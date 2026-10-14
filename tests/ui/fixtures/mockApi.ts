import type { Page, Route } from '@playwright/test';
import { isValidIsbn13 } from '../support/data';
import { GENRES, isGenre, type Book, type BookInput, type BookPage, type Problem } from '../support/types';

export interface RecordedRequest {
  method: string;
  url: URL;
  body: unknown;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Expose-Headers': 'Location',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * In-memory implementation of docs/api/openapi.yaml served through `page.route`.
 * The real HttpBooksApi in the app talks to it, so the full HTTP client path is exercised.
 */
export class MockApi {
  readonly isReal = false as const;
  private books: Book[] = [];
  private failures: number[] = [];
  private latencyMs = 0;
  private idSeq = 0;
  readonly requests: RecordedRequest[] = [];

  constructor(private readonly baseUrl: string) {}

  /** Installs the route handler on the page. */
  async attach(page: Page): Promise<void> {
    await page.route(`${this.baseUrl}/api/books**`, (route) => this.handle(route));
  }

  /** Replaces the whole catalog. Returns the stored books. */
  seed(books: readonly Omit<Book, 'createdAt'>[]): Book[] {
    const base = Date.UTC(2026, 0, 5, 9, 0, 0);
    this.books = books.map((b, i) => ({ ...b, createdAt: new Date(base + i * 86_400_000).toISOString() }));
    return this.snapshot();
  }

  snapshot(): Book[] {
    return this.books.map((b) => ({ ...b }));
  }

  /** The next `times` requests (any endpoint) fail with `status` and a problem+json body. */
  failNext(status: number, times = 1): void {
    for (let i = 0; i < times; i += 1) this.failures.push(status);
  }

  /** Adds latency to every subsequent response. */
  delay(ms: number): void {
    this.latencyMs = ms;
  }

  /** GET /api/books requests seen so far. */
  listRequests(): RecordedRequest[] {
    return this.requests.filter((r) => r.method === 'GET' && r.url.pathname === '/api/books');
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const url = new URL(request.url());
    let body: unknown = undefined;
    const raw = request.postData();
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }
    this.requests.push({ method, url, body });

    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    const injected = this.failures.shift();
    if (injected !== undefined) {
      await this.problem(route, { status: injected, title: injected >= 500 ? 'Internal Server Error' : 'Request failed', detail: 'Injected failure' });
      return;
    }

    const segments = url.pathname.split('/').filter(Boolean); // ['api','books',id?,'availability'?]
    const id = segments[2] ? decodeURIComponent(segments[2]) : undefined;
    const sub = segments[3];

    try {
      if (!id && method === 'GET') await this.list(route, url);
      else if (!id && method === 'POST') await this.create(route, body);
      else if (id && !sub && method === 'GET') await this.get(route, id);
      else if (id && !sub && method === 'DELETE') await this.remove(route, id);
      else if (id && sub === 'availability' && method === 'PATCH') await this.patchAvailability(route, id, body);
      else await this.problem(route, { status: 405, title: 'Method Not Allowed' });
    } catch (error) {
      // Page closed mid-request (test finished): nothing to fulfil.
      if (error instanceof Error && /closed|disposed/i.test(error.message)) return;
      throw error;
    }
  }

  private async json(route: Route, status: number, data: unknown, headers: Record<string, string> = {}): Promise<void> {
    await route.fulfill({ status, contentType: 'application/json', headers: { ...CORS_HEADERS, ...headers }, body: JSON.stringify(data) });
  }

  private async problem(route: Route, problem: Problem): Promise<void> {
    await route.fulfill({ status: problem.status, contentType: 'application/problem+json', headers: CORS_HEADERS, body: JSON.stringify(problem) });
  }

  private async list(route: Route, url: URL): Promise<void> {
    const params = url.searchParams;
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const genre = params.get('genre');
    const available = params.get('available');
    const page = Number(params.get('page') ?? '0');
    const size = Number(params.get('size') ?? '20');
    if (genre !== null && !isGenre(genre)) {
      await this.problem(route, { status: 400, title: 'Validation failed', errors: { genre: `must be one of ${GENRES.join(', ')}` } });
      return;
    }
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100) {
      await this.problem(route, { status: 400, title: 'Validation failed', errors: { size: 'must be between 1 and 100' } });
      return;
    }
    const matches = this.books.filter(
      (b) =>
        (q === '' || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)) &&
        (genre === null || b.genre === genre) &&
        (available === null || String(b.available) === available),
    );
    const result: BookPage = {
      items: matches.slice(page * size, page * size + size),
      page,
      size,
      totalItems: matches.length,
      totalPages: Math.ceil(matches.length / size),
    };
    await this.json(route, 200, result);
  }

  private validate(body: unknown): { input?: BookInput; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (!isRecord(body)) return { errors: { body: 'must be a JSON object' } };
    const { title, author, isbn, publishedYear, genre } = body;
    if (typeof title !== 'string' || title.trim().length < 1 || title.length > 200) errors.title = 'size must be between 1 and 200';
    if (typeof author !== 'string' || author.trim().length < 1 || author.length > 120) errors.author = 'size must be between 1 and 120';
    if (typeof isbn !== 'string' || !isValidIsbn13(isbn)) errors.isbn = 'must be a valid ISBN-13';
    if (typeof publishedYear !== 'number' || !Number.isInteger(publishedYear) || publishedYear < 1450 || publishedYear > new Date().getFullYear()) {
      errors.publishedYear = 'must be between 1450 and the current year';
    }
    if (!isGenre(genre)) errors.genre = 'must be a valid genre';
    if (Object.keys(errors).length > 0) return { errors };
    return { input: body as unknown as BookInput, errors };
  }

  private async create(route: Route, body: unknown): Promise<void> {
    const { input, errors } = this.validate(body);
    if (!input) {
      await this.problem(route, { status: 400, title: 'Validation failed', errors });
      return;
    }
    if (this.books.some((b) => b.isbn === input.isbn)) {
      await this.problem(route, { status: 409, title: 'Conflict', detail: 'A book with this ISBN already exists' });
      return;
    }
    this.idSeq += 1;
    const book: Book = {
      id: `c0000000-0000-4000-8000-${String(this.idSeq).padStart(12, '0')}`,
      title: input.title,
      author: input.author,
      isbn: input.isbn,
      publishedYear: input.publishedYear,
      genre: input.genre,
      available: true,
      createdAt: new Date().toISOString(),
    };
    this.books.push(book);
    await this.json(route, 201, book, { Location: `/api/books/${book.id}` });
  }

  private async get(route: Route, id: string): Promise<void> {
    const book = this.books.find((b) => b.id === id);
    if (!book) return this.problem(route, { status: 404, title: 'Not Found' });
    await this.json(route, 200, book);
  }

  private async remove(route: Route, id: string): Promise<void> {
    const before = this.books.length;
    this.books = this.books.filter((b) => b.id !== id);
    if (this.books.length === before) return this.problem(route, { status: 404, title: 'Not Found' });
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  }

  private async patchAvailability(route: Route, id: string, body: unknown): Promise<void> {
    const book = this.books.find((b) => b.id === id);
    if (!book) return this.problem(route, { status: 404, title: 'Not Found' });
    if (!isRecord(body) || typeof body.available !== 'boolean' || Object.keys(body).length !== 1) {
      return this.problem(route, { status: 400, title: 'Validation failed', errors: { available: 'must be a boolean' } });
    }
    book.available = body.available;
    await this.json(route, 200, book);
  }
}
