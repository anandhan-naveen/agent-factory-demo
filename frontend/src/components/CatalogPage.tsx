import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BooksApi } from '../api/client';
import type { Book } from '../api/types';
import { useBooks } from '../hooks/useBooks';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { BookList } from './BookList';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Filters, type FilterValues } from './Filters';

interface Props {
  api: BooksApi;
  notify: (message: string) => void;
}

const INITIAL_FILTERS: FilterValues = { search: '', genre: '', availableOnly: false };

export function CatalogPage({ api, notify }: Props) {
  const [filters, setFilters] = useState<FilterValues>(INITIAL_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search.trim(), 300);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  const { books, loading, error, reload, replaceBook, removeBook } = useBooks(api, {
    q: debouncedSearch,
    genre: filters.genre === '' ? undefined : filters.genre,
    available: filters.availableOnly ? true : undefined,
  });

  const filtersActive = filters.search.trim() !== '' || filters.genre !== '' || filters.availableOnly;

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleToggle = useCallback(
    async (book: Book) => {
      try {
        const updated = await api.setAvailability(book.id, !book.available);
        replaceBook(updated);
        notify(`“${updated.title}” marked ${updated.available ? 'available' : 'on loan'}`);
      } catch {
        notify(`Couldn’t update “${book.title}”. Please try again.`);
      }
    },
    [api, notify, replaceBook],
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
        notify(`Couldn’t delete “${book.title}”. Please try again.`);
        return false;
      }
    },
    [api, notify, removeBook],
  );

  let content;
  if (error) {
    content = <ErrorState message={error.message} onRetry={reload} />;
  } else if (books === null) {
    content = (
      <div className="state state--loading" role="status" data-testid="loading">
        <span className="spinner" aria-hidden="true" />
        Loading books…
      </div>
    );
  } else if (books.length === 0) {
    content = filtersActive ? (
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
      </>
    );
  }

  const count = books?.length ?? 0;

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

      <Filters values={filters} onChange={setFilters} />

      <div className="results">
        <div className="results__bar">
          <h2 className="results__heading" ref={resultsHeadingRef} tabIndex={-1}>
            {books === null ? 'Books' : `${String(count)} ${count === 1 ? 'book' : 'books'}`}
          </h2>
          {filtersActive && books !== null && books.length > 0 ? (
            <button type="button" className="link-button" onClick={clearFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
        {content}
      </div>
    </section>
  );
}
