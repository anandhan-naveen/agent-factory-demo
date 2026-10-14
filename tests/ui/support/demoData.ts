import type { Book } from './types';

/**
 * The in-browser demo seed (frontend/src/api/demoApi.ts), in the order the demo API lists it
 * (title, case-insensitive). Only used by the `demo` project.
 */
export const DEMO_SEED: readonly Omit<Book, 'id' | 'createdAt'>[] = [
  { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', publishedYear: 1988, genre: 'SCIENCE', available: true },
  { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', isbn: '9780062316097', publishedYear: 2011, genre: 'NON_FICTION', available: false },
  { title: 'The Gene: An Intimate History', author: 'Siddhartha Mukherjee', isbn: '9781476733500', publishedYear: 2016, genre: 'SCIENCE', available: true },
  { title: 'The Guns of August', author: 'Barbara W. Tuchman', isbn: '9780345476098', publishedYear: 1962, genre: 'HISTORY', available: true },
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', isbn: '9780441478125', publishedYear: 1969, genre: 'FICTION', available: true },
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt and David Thomas', isbn: '9780135957059', publishedYear: 2019, genre: 'TECHNOLOGY', available: false },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', publishedYear: 1960, genre: 'FICTION', available: true },
  { title: 'Where the Wild Things Are', author: 'Maurice Sendak', isbn: '9780060254926', publishedYear: 1963, genre: 'CHILDREN', available: true },
];
