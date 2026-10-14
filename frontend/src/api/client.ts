import type { Book, BookInput, BookPage, BookQuery, ProblemDetail } from './types';

/** Error raised for any non-2xx response (or a network failure, status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly errors: Readonly<Record<string, string>>;

  constructor(status: number, title: string, errors: Record<string, string> = {}, detail?: string) {
    super(detail ?? title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.errors = errors;
  }
}

export interface BooksApi {
  readonly mode: 'http' | 'demo';
  listBooks(query: BookQuery, signal?: AbortSignal): Promise<BookPage>;
  getBook(id: string, signal?: AbortSignal): Promise<Book>;
  createBook(input: BookInput, signal?: AbortSignal): Promise<Book>;
  setAvailability(id: string, available: boolean, signal?: AbortSignal): Promise<Book>;
  deleteBook(id: string, signal?: AbortSignal): Promise<void>;
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function buildQueryString(query: BookQuery): string {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set('q', q);
  if (query.genre) params.set('genre', query.genre);
  if (query.available !== undefined) params.set('available', String(query.available));
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.size !== undefined) params.set('size', String(query.size));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Defensive parse of an RFC 7807 body: keeps only well-typed fields. */
export function parseProblem(body: unknown): ProblemDetail {
  if (!isRecord(body)) return {};
  const problem: ProblemDetail = {};
  if (typeof body.type === 'string') problem.type = body.type;
  if (typeof body.title === 'string') problem.title = body.title;
  if (typeof body.status === 'number') problem.status = body.status;
  if (typeof body.detail === 'string') problem.detail = body.detail;
  if (typeof body.instance === 'string') problem.instance = body.instance;
  if (isRecord(body.errors)) {
    const errors: Record<string, string> = {};
    for (const [field, message] of Object.entries(body.errors)) {
      if (typeof message === 'string') errors[field] = message;
    }
    problem.errors = errors;
  }
  return problem;
}

export async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {};
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      problem = parseProblem(await response.json());
    } catch {
      problem = {};
    }
  }
  const title = problem.title ?? (response.statusText || `Request failed (${String(response.status)})`);
  return new ApiError(response.status, title, problem.errors ?? {}, problem.detail);
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Removes trailing '/' characters in linear time (no backtracking regex). */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.endsWith('/', end)) end -= 1;
  return value.slice(0, end);
}

export class HttpBooksApi implements BooksApi {
  readonly mode = 'http' as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
    this.baseUrl = stripTrailingSlashes(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new ApiError(0, 'Network error', {}, 'Could not reach the catalog server. Check your connection and try again.');
    }
    if (!response.ok) throw await toApiError(response);
    return response;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(path, init);
    return (await response.json()) as T;
  }

  listBooks(query: BookQuery, signal?: AbortSignal): Promise<BookPage> {
    return this.json<BookPage>(`/api/books${buildQueryString(query)}`, { signal });
  }

  getBook(id: string, signal?: AbortSignal): Promise<Book> {
    return this.json<Book>(`/api/books/${encodeURIComponent(id)}`, { signal });
  }

  createBook(input: BookInput, signal?: AbortSignal): Promise<Book> {
    return this.json<Book>('/api/books', { method: 'POST', body: JSON.stringify(input), signal });
  }

  setAvailability(id: string, available: boolean, signal?: AbortSignal): Promise<Book> {
    return this.json<Book>(`/api/books/${encodeURIComponent(id)}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ available }),
      signal,
    });
  }

  async deleteBook(id: string, signal?: AbortSignal): Promise<void> {
    await this.request(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
  }
}
