import type { Book, BookInput } from './types';

export function isbn13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidIsbn13(value: string): boolean {
  return /^\d{13}$/.test(value) && isbn13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/** A random, checksum-valid ISBN-13 (978 prefix). */
export function randomIsbn(): string {
  let body = '978';
  // eslint-disable-next-line sonarjs/pseudo-random -- test-data ISBN digits only; not security-sensitive.
  while (body.length < 12) body += String(Math.floor(Math.random() * 10));
  return body + String(isbn13CheckDigit(body));
}

/** Same number with a wrong check digit. */
export function withBadCheckDigit(isbn: string): string {
  const good = Number(isbn[12]);
  return isbn.slice(0, 12) + String((good + 1) % 10);
}

export const CURRENT_YEAR = new Date().getFullYear();

/** Deterministic catalog used by the mocked project. Covers all six genres and both availability states. */
export const SEED_BOOKS: readonly Omit<Book, 'createdAt'>[] = [
  { id: 'b0000001-0000-4000-8000-000000000001', title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', publishedYear: 1960, genre: 'FICTION', available: true },
  { id: 'b0000001-0000-4000-8000-000000000002', title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', isbn: '9780062316097', publishedYear: 2011, genre: 'NON_FICTION', available: false },
  { id: 'b0000001-0000-4000-8000-000000000003', title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', publishedYear: 1988, genre: 'SCIENCE', available: true },
  { id: 'b0000001-0000-4000-8000-000000000004', title: 'The Guns of August', author: 'Barbara W. Tuchman', isbn: '9780345476098', publishedYear: 1962, genre: 'HISTORY', available: true },
  { id: 'b0000001-0000-4000-8000-000000000005', title: 'The Pragmatic Programmer', author: 'Andrew Hunt and David Thomas', isbn: '9780135957059', publishedYear: 2019, genre: 'TECHNOLOGY', available: false },
  { id: 'b0000001-0000-4000-8000-000000000006', title: 'Where the Wild Things Are', author: 'Maurice Sendak', isbn: '9780060254926', publishedYear: 1963, genre: 'CHILDREN', available: true },
  { id: 'b0000001-0000-4000-8000-000000000007', title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', isbn: '9780441478125', publishedYear: 1969, genre: 'FICTION', available: false },
  { id: 'b0000001-0000-4000-8000-000000000008', title: 'The Gene: An Intimate History', author: 'Siddhartha Mukherjee', isbn: '9781476733500', publishedYear: 2016, genre: 'SCIENCE', available: true },
];

export function newBookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    title: 'The Midnight Library',
    author: 'Matt Haig',
    isbn: randomIsbn(),
    publishedYear: 2020,
    genre: 'FICTION',
    ...overrides,
  };
}

/** First item matching `predicate`; throws (fails the test) when the seed has none. */
export function pick<T>(items: readonly T[], predicate: (item: T) => boolean = () => true): T {
  const found = items.find(predicate);
  if (found === undefined) throw new Error('Seed data does not contain a matching item');
  return found;
}
