import { describe, expect, it } from 'vitest';
import {
  firstInvalidField,
  hasErrors,
  isValidIsbn13,
  normalizeIsbn,
  toBookInput,
  validateBook,
  type BookDraft,
} from './validation';

const NOW = new Date('2026-06-15T12:00:00Z');

const valid: BookDraft = {
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441172719',
  publishedYear: '1965',
  genre: 'FICTION',
};

describe('isValidIsbn13', () => {
  it.each(['9780061120084', '9780306406157', '9791000000008', '9780000000040'])('accepts valid ISBN %s', (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(true);
  });

  it('accepts a check digit of 0', () => {
    expect(isValidIsbn13('9780000000040')).toBe(true);
    expect(isValidIsbn13('9780000000041')).toBe(false);
  });

  it.each([
    ['wrong check digit', '9780061120085'],
    ['12 digits', '978006112008'],
    ['14 digits', '97800611200840'],
    ['letters', '978006112008X'],
    ['hyphens (not normalized)', '978-0061120084'],
    ['empty', ''],
    ['transposed digits', '9780061210084'],
  ])('rejects %s', (_label, isbn) => {
    expect(isValidIsbn13(isbn)).toBe(false);
  });

  it('normalizes spaces and hyphens', () => {
    expect(normalizeIsbn('978-0-06-112008 4')).toBe('9780061120084');
  });
});

describe('validateBook', () => {
  it('returns no errors for a valid book', () => {
    expect(validateBook(valid, NOW)).toEqual({});
  });

  it('requires every field', () => {
    const errors = validateBook({ title: '', author: '   ', isbn: '', publishedYear: '', genre: '' }, NOW);
    expect(errors).toEqual({
      title: 'Title is required',
      author: 'Author is required',
      isbn: 'ISBN is required',
      publishedYear: 'Published year is required',
      genre: 'Choose a genre',
    });
    expect(firstInvalidField(errors)).toBe('title');
  });

  it('treats non-string values as missing', () => {
    const errors = validateBook({ title: 42, author: null, isbn: undefined, publishedYear: null, genre: 7 }, NOW);
    expect(Object.keys(errors).sort((a, b) => a.localeCompare(b))).toEqual(['author', 'genre', 'isbn', 'publishedYear', 'title']);
  });

  it('enforces title length 1–200', () => {
    expect(validateBook({ ...valid, title: 'a'.repeat(200) }, NOW).title).toBeUndefined();
    expect(validateBook({ ...valid, title: 'a'.repeat(201) }, NOW).title).toBe('Title must be 200 characters or fewer');
  });

  it('enforces author length 1–120', () => {
    expect(validateBook({ ...valid, author: 'b'.repeat(120) }, NOW).author).toBeUndefined();
    expect(validateBook({ ...valid, author: 'b'.repeat(121) }, NOW).author).toBe('Author must be 120 characters or fewer');
  });

  it('accepts a hyphenated ISBN with a valid checksum', () => {
    expect(validateBook({ ...valid, isbn: '978-0-441-17271-9' }, NOW).isbn).toBeUndefined();
  });

  it('distinguishes ISBN format and checksum errors', () => {
    expect(validateBook({ ...valid, isbn: '12345' }, NOW).isbn).toBe('ISBN must be exactly 13 digits');
    expect(validateBook({ ...valid, isbn: '9780441172710' }, NOW).isbn).toBe('This ISBN-13 has an invalid check digit');
  });

  it.each([
    ['1449', false],
    ['1450', true],
    ['2026', true],
    ['2027', false],
    ['19a5', false],
    ['-1990', false],
  ])('year %s valid=%s', (year, ok) => {
    const error = validateBook({ ...valid, publishedYear: year }, NOW).publishedYear;
    if (ok) expect(error).toBeUndefined();
    else expect(error).toBe('Enter a year between 1450 and 2026');
  });

  it('accepts numeric years and rejects non-integers', () => {
    expect(validateBook({ ...valid, publishedYear: 1999 }, NOW).publishedYear).toBeUndefined();
    expect(validateBook({ ...valid, publishedYear: 1999.5 }, NOW).publishedYear).toBeDefined();
  });

  it('uses the supplied clock for the upper year bound', () => {
    expect(validateBook({ ...valid, publishedYear: '2030' }, new Date('2030-01-01T12:00:00Z')).publishedYear).toBeUndefined();
  });

  it('rejects unknown genres', () => {
    expect(validateBook({ ...valid, genre: 'POETRY' }, NOW).genre).toBe('Choose a valid genre');
  });

  it('reports the first invalid field in form order', () => {
    const errors = validateBook({ ...valid, isbn: '1', genre: '' }, NOW);
    expect(firstInvalidField(errors)).toBe('isbn');
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });
});

describe('toBookInput', () => {
  it('trims and normalizes the draft', () => {
    expect(
      toBookInput({ title: '  Dune ', author: ' Frank Herbert ', isbn: '978-0441172719', publishedYear: ' 1965 ', genre: 'FICTION' }),
    ).toEqual({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719', publishedYear: 1965, genre: 'FICTION' });
  });

  it('throws on an invalid genre', () => {
    expect(() => toBookInput({ title: 'a', author: 'b', isbn: '1', publishedYear: '2000', genre: 'NOPE' })).toThrow();
  });
});
