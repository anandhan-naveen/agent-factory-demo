import { randomInt, randomUUID } from 'node:crypto';

/** ISBN-13 check digit: weights 1,3,1,3,… over the first 12 digits. */
export function isbn13CheckDigit(first12: string): number {
  const sum = first12.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/** A fresh, valid ISBN-13 (978 prefix + 9 random digits + check digit). */
export function uniqueIsbn(): string {
  const body = Array.from({ length: 9 }, () => randomInt(10)).join('');
  const first12 = `978${body}`;
  return `${first12}${isbn13CheckDigit(first12)}`;
}

/** A fresh, valid ISBN-13 whose check digit is `digit` (edge case for checksum implementations). */
export function uniqueIsbnEndingWith(digit: number): string {
  for (;;) {
    const isbn = uniqueIsbn();
    if (isbn.endsWith(String(digit))) return isbn;
  }
}

/** Same first 12 digits, wrong check digit. */
export function isbnWithBadChecksum(): string {
  const valid = uniqueIsbn();
  const wrong = (Number(valid.slice(-1)) + 1) % 10;
  return `${valid.slice(0, 12)}${wrong}`;
}

/** Short lowercase token that will not appear in seed data; used to isolate search results. */
export function uniqueToken(): string {
  return `zq${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export const CURRENT_YEAR = new Date().getFullYear();

export type Genre = 'FICTION' | 'NON_FICTION' | 'SCIENCE' | 'HISTORY' | 'TECHNOLOGY' | 'CHILDREN';

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
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}

export function validBookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    title: `API test book ${uniqueToken()}`,
    author: 'Test Author',
    isbn: uniqueIsbn(),
    publishedYear: 2001,
    genre: 'FICTION',
    ...overrides,
  };
}

/** A syntactically valid UUID that no server will have stored. */
export function unknownId(): string {
  return randomUUID();
}
