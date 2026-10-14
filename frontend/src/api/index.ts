import { HttpBooksApi, type BooksApi } from './client';
import { DemoBooksApi } from './demoApi';

export { ApiError, HttpBooksApi, type BooksApi } from './client';
export { DemoBooksApi } from './demoApi';
export * from './types';

/** HTTP client when a base URL is configured, otherwise the in-browser demo API. */
export function createBooksApi(baseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL): BooksApi {
  const url = baseUrl?.trim();
  return url ? new HttpBooksApi(url) : new DemoBooksApi();
}
