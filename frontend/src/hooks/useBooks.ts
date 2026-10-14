import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError, type BooksApi } from '../api/client';
import type { Book, Genre } from '../api/types';

export interface BooksFilter {
  q: string;
  genre?: Genre;
  available?: boolean;
}

export interface BooksState {
  books: Book[] | null;
  /** Total matches reported by the API (all pages), adjusted for local removals. */
  totalItems: number;
  loading: boolean;
  error: Error | null;
}

/** Page size requested from the API (the contract's maximum). Further pages load on demand. */
export const CATALOG_PAGE_SIZE = 100;

export function useBooks(api: BooksApi, filter: BooksFilter) {
  const [state, setState] = useState<BooksState>({ books: null, totalItems: 0, loading: true, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Bumped whenever a local mutation is applied; a list response started before it is stale. */
  const mutationSeq = useRef(0);
  /** Bumped on every (re)load of page 0; a "load more" response from an older generation is discarded. */
  const generation = useRef(0);
  const moreController = useRef<AbortController | null>(null);
  /** True while page 0 is (re)loading; read synchronously by loadMore, which must not run against a stale list. */
  const pageZeroLoading = useRef(true);
  /** Ids removed locally in this generation, so a later page can't bring them back. */
  const removedIds = useRef(new Set<string>());
  const { q, genre, available } = filter;

  useEffect(() => {
    const controller = new AbortController();
    generation.current += 1;
    removedIds.current = new Set();
    const cancelLoadMore = () => {
      moreController.current?.abort();
      moreController.current = null;
      setLoadingMore(false);
    };
    cancelLoadMore();
    pageZeroLoading.current = true;
    const seqAtStart = mutationSeq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.listBooks({ q, genre, available, page: 0, size: CATALOG_PAGE_SIZE }, controller.signal).then(
      (page) => {
        if (controller.signal.aborted) return;
        if (mutationSeq.current !== seqAtStart) {
          // A toggle/delete landed while this request was in flight: its snapshot may predate it.
          setAttempt((n) => n + 1);
          return;
        }
        // Page 0 replaces the list: any "load more" still running was computed from the old one.
        generation.current += 1;
        cancelLoadMore();
        pageZeroLoading.current = false;
        setState({ books: page.items, totalItems: page.totalItems, loading: false, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        pageZeroLoading.current = false;
        setState({ books: null, totalItems: 0, loading: false, error: error instanceof Error ? error : new Error('Unknown error') });
      },
    );
    return () => {
      controller.abort();
    };
  }, [api, q, genre, available, attempt]);

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const loadedCount = state.books?.length ?? 0;

  /**
   * Appends the next page. The page index is derived from how many books are loaded, and items
   * are merged by id, so local deletions (which shift server offsets) never skip or duplicate a book.
   * It is a no-op while page 0 is loading: the loaded count would belong to the previous query.
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (moreController.current || pageZeroLoading.current) return;
    const controller = new AbortController();
    moreController.current = controller;
    const gen = generation.current;
    const seqAtStart = mutationSeq.current;
    setLoadingMore(true);
    try {
      const page = await api.listBooks(
        { q, genre, available, page: Math.floor(loadedCount / CATALOG_PAGE_SIZE), size: CATALOG_PAGE_SIZE },
        controller.signal,
      );
      if (controller.signal.aborted || gen !== generation.current) return;
      setState((s) => {
        const current = s.books ?? [];
        const known = new Set(current.map((b) => b.id));
        const fresh = page.items.filter((b) => !known.has(b.id) && !removedIds.current.has(b.id));
        // A local toggle/delete since the request started already adjusted totalItems; the server's
        // count may predate it, so only take it when nothing changed locally.
        const totalItems = mutationSeq.current === seqAtStart ? page.totalItems : s.totalItems;
        return { ...s, books: [...current, ...fresh], totalItems };
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      throw error;
    } finally {
      if (moreController.current === controller) {
        moreController.current = null;
        setLoadingMore(false);
      }
    }
  }, [api, q, genre, available, loadedCount]);

  const replaceBook = useCallback((book: Book) => {
    mutationSeq.current += 1;
    setState((s) => ({ ...s, books: s.books?.map((b) => (b.id === book.id ? book : b)) ?? null }));
  }, []);

  const removeBook = useCallback((id: string) => {
    mutationSeq.current += 1;
    removedIds.current.add(id);
    setState((s) => {
      if (!s.books?.some((b) => b.id === id)) return s;
      return { ...s, books: s.books.filter((b) => b.id !== id), totalItems: Math.max(0, s.totalItems - 1) };
    });
  }, []);

  const hasMore = state.books !== null && state.books.length < state.totalItems;

  return { ...state, hasMore, loadingMore, reload, loadMore, replaceBook, removeBook };
}
