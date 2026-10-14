import { isGenre, type BookInput } from '../api/types';

export type BookField = 'title' | 'author' | 'isbn' | 'publishedYear' | 'genre';

/** Field order used to pick the first invalid field. */
export const BOOK_FIELDS: readonly BookField[] = ['title', 'author', 'isbn', 'publishedYear', 'genre'];

export type FieldErrors = Partial<Record<BookField, string>>;

/** Raw, possibly untrusted input (form strings or API JSON). */
export interface BookDraft {
  title: unknown;
  author: unknown;
  isbn: unknown;
  publishedYear: unknown;
  genre: unknown;
}

export const MIN_YEAR = 1450;
export const TITLE_MAX = 200;
export const AUTHOR_MAX = 120;
export const DUPLICATE_ISBN_MESSAGE = 'A book with this ISBN already exists';

/** Strips the spaces and hyphens people commonly type in an ISBN. */
export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function isValidIsbn13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[12]);
}

function parseYear(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateBook(input: BookDraft, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  const currentYear = now.getFullYear();

  const title = text(input.title);
  if (title.length === 0) errors.title = 'Title is required';
  else if (title.length > TITLE_MAX) errors.title = `Title must be ${String(TITLE_MAX)} characters or fewer`;

  const author = text(input.author);
  if (author.length === 0) errors.author = 'Author is required';
  else if (author.length > AUTHOR_MAX) errors.author = `Author must be ${String(AUTHOR_MAX)} characters or fewer`;

  const isbn = normalizeIsbn(text(input.isbn));
  if (isbn.length === 0) errors.isbn = 'ISBN is required';
  else if (!/^\d{13}$/.test(isbn)) errors.isbn = 'ISBN must be exactly 13 digits';
  else if (!isValidIsbn13(isbn)) errors.isbn = 'This ISBN-13 has an invalid check digit';

  const rawYear = typeof input.publishedYear === 'string' ? input.publishedYear.trim() : input.publishedYear;
  if (rawYear === '' || rawYear === undefined || rawYear === null) {
    errors.publishedYear = 'Published year is required';
  } else {
    const year = parseYear(rawYear);
    if (year === null || year < MIN_YEAR || year > currentYear) {
      errors.publishedYear = `Enter a year between ${String(MIN_YEAR)} and ${String(currentYear)}`;
    }
  }

  if (text(input.genre) === '') errors.genre = 'Choose a genre';
  else if (!isGenre(input.genre)) errors.genre = 'Choose a valid genre';

  return errors;
}

export function firstInvalidField(errors: FieldErrors): BookField | undefined {
  return BOOK_FIELDS.find((field) => errors[field] !== undefined);
}

export function hasErrors(errors: FieldErrors): boolean {
  return firstInvalidField(errors) !== undefined;
}

/** Converts an already-validated draft into the API payload. */
export function toBookInput(draft: { title: string; author: string; isbn: string; publishedYear: string; genre: string }): BookInput {
  const genre = draft.genre;
  if (!isGenre(genre)) throw new Error('toBookInput called with an invalid genre');
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    isbn: normalizeIsbn(draft.isbn.trim()),
    publishedYear: Number(draft.publishedYear.trim()),
    genre,
  };
}
