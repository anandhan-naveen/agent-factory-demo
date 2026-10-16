import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { BooksApi } from '../api/client';
import type { Book } from '../api/types';
import { useBooks } from '../hooks/useBooks';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { BookList } from './BookList';
import { wantsResultsFocus } from './catalogFocus';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { describeLoadError } from './loadError';
import { Filters, type FilterValues } from './Filters';
import type { ToastKind } from './Toast';

interface Props {
  api: BooksApi;
  notify: (message: string, kind?: ToastKind) => void;
}

const INITIAL_FILTERS: FilterValues = { search: '', genre: '', availableOnly: false };

function booksLabel(n: number): string {
  return `${String(n)} ${n === 1 ? 'book' : 'books'}`;
}

/** Text for the always-mounted live region once a load has settled (empty while loading or on error). */
function resultsAnnouncement(books: Book[] | null, totalItems: number, hasMore: boolean, filtersActive: boolean): string {
  if (books === null) return '';
  if (books.length === 0) return filtersActive ? 'No books match your filters' : 'The catalog is empty';
  if (hasMore) return `${booksLabel(totalItems)} found, ${String(books.length)} shown`;
  return `${booksLabel(totalItems)} found`;
}

function renderEmpty(filtersActive: boolean, clearFilters: () => void) {
  return filtersActive ? (
    <EmptyState title="No books match your filters">
      <p className="state__detail">Try a different search, or widen the genre and availability filters.</p>
      <button type="button" className="button button--secondary" onClick={clearFilters} data-testid="clear-filters">
        Clear filters
      </button>
    </EmptyState>
  ) : (
    <EmptyState title="The catalog is empty">
      <p className="state__detail">Add the first book to start your catalog.</p>
    </EmptyState>
  );
}

/** Plain-language load error; "Clear filters" is offered only when the active filters caused it. */
function renderError(error: unknown, filtersActive: boolean, retry: () => void, clearFilters: () => void) {
  const copy = describeLoadError(error, filtersActive);
  return <ErrorState message={copy.message} onRetry={retry} onClearFilters={copy.filtersCause ? clearFilters : undefined} />;
}

/** `blocked` is true while page 0 reloads (new filter) or another page is loading. */
function renderLoadMore(shown: number, totalItems: number, loadingMore: boolean, blocked: boolean, onLoadMore: () => Promise<void>) {
  return (
    <div className="results__more">
      <p className="results__shown">
        Showing {String(shown)} of {String(totalItems)}
      </p>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          if (!blocked) void onLoadMore();
        }}
        aria-disabled={blocked}
        data-testid="load-more"
      >
        {loadingMore ? 'Loading…' : 'Load more books'}
      </button>
    </div>
  );
}

export function CatalogPage({ api, notify }: Readonly<Props>) {
  const [filters, setFilters] = useState<FilterValues>(INITIAL_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search.trim(), 300);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { books, totalItems, hasMore, loading, loadingMore, error, reload, loadMore, replaceBook, removeBook } = useBooks(api, {
    q: debouncedSearch,
    genre: filters.genre === '' ? undefined : filters.genre,
    available: filters.availableOnly ? true : undefined,
  });

  // Arriving from the add-book page (save or cancel): put focus on the results heading.
  const focusOnArrival = wantsResultsFocus(location.state);
  useEffect(() => {
    if (!focusOnArrival) return;
    resultsHeadingRef.current?.focus();
    navigate(location.pathname, { replace: true, state: null });
  }, [focusOnArrival, navigate, location.pathname]);

  const filtersActive = filters.search.trim() !== '' || filters.genre !== '' || filters.availableOnly;

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    searchRef.current?.focus();
  }, []);

  const retry = useCallback(() => {
    reload();
    resultsHeadingRef.current?.focus();
  }, [reload]);

  const handleToggle = useCallback(
    async (book: Book) => {
      try {
        const updated = await api.setAvailability(book.id, !book.available);
        if (filters.availableOnly && !updated.available) {
          // The book no longer matches "Available only": drop it, and keep focus on the page.
          removeBook(updated.id);
          resultsHeadingRef.current?.focus();
        } else {
          replaceBook(updated);
        }
        notify(`“${updated.title}” marked ${updated.available ? 'available' : 'on loan'}`);
      } catch {
        notify(`Couldn’t update “${book.title}”. Please try again.`, 'error');
      }
    },
    [api, notify, replaceBook, removeBook, filters.availableOnly],
  );

  const handleDelete = useCallback(
    async (book: Book): Promise<boolean> => {
      try {
        await api.deleteBook(book.id);
        removeBook(book.id);
        notify(`“${book.title}” deleted`);
        resultsHeadingRef.current?.focus();
        return true;
      } catch {
        notify(`Couldn’t delete “${book.title}”. Please try again.`, 'error');
        return false;
      }
    },
    [api, notify, removeBook],
  );

  const handleLoadMore = useCallback(async () => {
    try {
      await loadMore();
    } catch {
      notify('Couldn’t load more books. Please try again.', 'error');
    }
  }, [loadMore, notify]);

  // Keep focus on the page when the "Load more" button disappears after the last page.
  const hadMore = useRef(hasMore);
  useEffect(() => {
    if (hadMore.current && !hasMore && document.activeElement === document.body) resultsHeadingRef.current?.focus();
    hadMore.current = hasMore;
  }, [hasMore]);

  let content;
  if (error) {
    content = renderError(error, filtersActive, retry, clearFilters);
  } else if (books === null) {
    content = (
      <div className="state state--loading" role="status" data-testid="loading">
        <span className="spinner" aria-hidden="true" />
        Loading books…
      </div>
    );
  } else if (books.length === 0) {
    content = renderEmpty(filtersActive, clearFilters);
  } else {
    content = (
      <>
        {loading ? (
          <p className="refreshing" role="status" data-testid="loading">
            <span className="spinner spinner--small" aria-hidden="true" />
            Updating results…
          </p>
        ) : null}
        <BookList books={books} busy={loading} onToggleAvailability={handleToggle} onDelete={handleDelete} />
        {hasMore ? renderLoadMore(books.length, totalItems, loadingMore, loading || loadingMore, handleLoadMore) : null}
      </>
    );
  }

  // Always-mounted live region: announces the outcome of every search/filter change (WCAG 4.1.3).
  const announcement = loading || error ? '' : resultsAnnouncement(books, totalItems, hasMore, filtersActive);

  return (
    <section className="page" aria-labelledby="catalog-heading">
      <header className="page__header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1 id="catalog-heading" className="page__title">
            Catalog
          </h1>
          <p className="page__lede">Browse, search and keep the shelves up to date.</p>
        </div>
        <Link to="/books/new" className="button button--primary button--lg" data-testid="add-book-button">
          <span aria-hidden="true" className="button__plus">
            +
          </span>
          Add book
        </Link>
      </header>

      <Filters values={filters} onChange={setFilters} searchRef={searchRef} />

      <div className="results">
        <div className="results__bar">
          <h2 className="results__heading" ref={resultsHeadingRef} tabIndex={-1}>
            {books === null ? 'Books' : booksLabel(totalItems)}
          </h2>
          {filtersActive && books !== null && books.length > 0 ? (
            <button type="button" className="link-button" onClick={clearFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
        <p className="visually-hidden" role="status" aria-live="polite" data-testid="results-status">
          {announcement}
        </p>
        {content}
      </div>
    </section>
  );
}
