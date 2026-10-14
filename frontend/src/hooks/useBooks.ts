import { useCallback, useEffect, useState } from 'react';
import { isAbortError, type BooksApi } from '../api/client';
import type { Book, Genre } from '../api/types';

export interface BooksFilter {
  q: string;
  genre?: Genre;
  available?: boolean;
}

export interface BooksState {
  books: Book[] | null;
  loading: boolean;
  error: Error | null;
}

/** Page size requested from the API; the catalog shows everything on one screen. */
export const CATALOG_PAGE_SIZE = 100;

export function useBooks(api: BooksApi, filter: BooksFilter) {
  const [state, setState] = useState<BooksState>({ books: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const { q, genre, available } = filter;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api.listBooks({ q, genre, available, page: 0, size: CATALOG_PAGE_SIZE }, controller.signal).then(
      (page) => {
        setState({ books: page.items, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error)) return;
        setState({ books: null, loading: false, error: error instanceof Error ? error : new Error('Unknown error') });
      },
    );
    return () => {
      controller.abort();
    };
  }, [api, q, genre, available, attempt]);

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const replaceBook = useCallback((book: Book) => {
    setState((s) => ({ ...s, books: s.books?.map((b) => (b.id === book.id ? book : b)) ?? null }));
  }, []);

  const removeBook = useCallback((id: string) => {
    setState((s) => ({ ...s, books: s.books?.filter((b) => b.id !== id) ?? null }));
  }, []);

  return { ...state, reload, replaceBook, removeBook };
}
