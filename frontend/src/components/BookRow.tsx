import { useEffect, useRef, useState } from 'react';
import type { Book } from '../api/types';
import { GENRE_LABELS } from '../domain/genres';
import { AvailabilityBadge } from './AvailabilityBadge';
import { DeleteConfirm } from './DeleteConfirm';

interface Props {
  book: Book;
  onToggleAvailability: (book: Book) => Promise<void>;
  onDelete: (book: Book) => Promise<boolean>;
}

export function BookRow({ book, onToggleAvailability, onDelete }: Readonly<Props>) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const titleId = `book-title-${book.id}`;

  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false;
      deleteRef.current?.focus();
    }
  }, [confirming]);

  function closeConfirm(): void {
    restoreFocus.current = true;
    setConfirming(false);
  }

  async function handleToggle(): Promise<void> {
    // aria-disabled (not `disabled`) keeps keyboard focus on the button while the request runs.
    if (busy) return;
    setBusy(true);
    try {
      await onToggleAvailability(book);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const deleted = await onDelete(book);
    if (!deleted) {
      setBusy(false);
      closeConfirm();
    }
  }

  return (
    <li className="book" data-testid="book-row" data-book-id={book.id} aria-labelledby={titleId}>
      <div className="book__main">
        <h3 className="book__title" id={titleId} data-testid="book-title">
          {book.title}
        </h3>
        <p className="book__author">{book.author}</p>
        <p className="book__meta">
          <span>{GENRE_LABELS[book.genre]}</span>
          <span aria-hidden="true" className="book__sep">·</span>
          <span>
            <span className="visually-hidden">Published </span>
            {book.publishedYear}
          </span>
          <span aria-hidden="true" className="book__sep">·</span>
          <span className="book__isbn">
            <span className="visually-hidden">ISBN </span>
            {book.isbn}
          </span>
        </p>
      </div>
      <div className="book__status">
        <AvailabilityBadge available={book.available} />
      </div>
      <div className="book__actions">
        {confirming ? (
          <DeleteConfirm title={book.title} busy={busy} onConfirm={() => void handleConfirmDelete()} onCancel={closeConfirm} />
        ) : (
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void handleToggle()}
              aria-disabled={busy}
              aria-label={book.available ? `Mark ${book.title} as on loan` : `Mark ${book.title} as available`}
              data-testid="toggle-availability"
            >
              {book.available ? 'Mark on loan' : 'Mark available'}
            </button>
            <button
              type="button"
              className="button button--ghost button--danger-text"
              onClick={() => {
                if (!busy) setConfirming(true);
              }}
              aria-disabled={busy}
              ref={deleteRef}
              aria-label={`Delete ${book.title}`}
              data-testid="delete-book"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
