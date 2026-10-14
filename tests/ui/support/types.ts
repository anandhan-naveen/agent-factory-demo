/** Mirrors docs/api/openapi.yaml (components.schemas). Kept independent of frontend/ on purpose. */
export const GENRES = ['FICTION', 'NON_FICTION', 'SCIENCE', 'HISTORY', 'TECHNOLOGY', 'CHILDREN'] as const;
export type Genre = (typeof GENRES)[number];

export const GENRE_LABELS: Record<Genre, string> = {
  FICTION: 'Fiction',
  NON_FICTION: 'Non-fiction',
  SCIENCE: 'Science',
  HISTORY: 'History',
  TECHNOLOGY: 'Technology',
  CHILDREN: 'Children',
};

export interface BookInput {
  title: string;
  author: string;
  isbn: string;
  publishedYear: number;
  genre: Genre;
}

export interface Book extends BookInput {
  id: string;
  available: boolean;
  createdAt: string;
}

export interface BookPage {
  items: Book[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string>;
}

export function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && (GENRES as readonly string[]).includes(value);
}
