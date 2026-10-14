/** Types mirroring docs/api/openapi.yaml (components.schemas). */

export const GENRES = ['FICTION', 'NON_FICTION', 'SCIENCE', 'HISTORY', 'TECHNOLOGY', 'CHILDREN'] as const;

export type Genre = (typeof GENRES)[number];

export function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && (GENRES as readonly string[]).includes(value);
}

export interface BookInput {
  title: string;
  author: string;
  /** 13 digits, valid ISBN-13 checksum. */
  isbn: string;
  publishedYear: number;
  genre: Genre;
}

export interface Book extends BookInput {
  id: string;
  available: boolean;
  /** ISO-8601 date-time. */
  createdAt: string;
}

export interface BookPage {
  items: Book[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** RFC 7807 problem detail. `errors` maps field name to message (400 only). */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}

/** Query parameters of GET /api/books. */
export interface BookQuery {
  q?: string;
  genre?: Genre;
  available?: boolean;
  page?: number;
  size?: number;
}
