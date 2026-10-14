import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BooksApi } from '../api/client';
import type { BookInput } from '../api/types';
import { BookForm } from './BookForm';
import { CATALOG_FOCUS_RESULTS } from './catalogFocus';

interface Props {
  api: BooksApi;
  notify: (message: string) => void;
  now?: () => Date;
}

export function AddBookPage({ api, notify, now }: Readonly<Props>) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSave(input: BookInput): Promise<void> {
    await api.createBook(input);
    notify('Book added');
    navigate('/', { state: CATALOG_FOCUS_RESULTS });
  }

  return (
    <section className="page page--narrow" aria-labelledby="add-book-heading">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">Catalog</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">New book</span>
      </nav>
      <header className="page__header page__header--stacked">
        <h1 id="add-book-heading" className="page__title" ref={headingRef} tabIndex={-1}>
          Add a book
        </h1>
        <p className="page__lede">All fields are required. New books are added as available.</p>
      </header>
      <div className="card">
        <BookForm
          onSave={handleSave}
          onCancel={() => {
            navigate('/', { state: CATALOG_FOCUS_RESULTS });
          }}
          now={now}
        />
      </div>
    </section>
  );
}
