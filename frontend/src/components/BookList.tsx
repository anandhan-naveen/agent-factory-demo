import type { Book } from '../api/types';
import { BookRow } from './BookRow';

interface Props {
  books: Book[];
  busy: boolean;
  onToggleAvailability: (book: Book) => Promise<void>;
  onDelete: (book: Book) => Promise<boolean>;
}

export function BookList({ books, busy, onToggleAvailability, onDelete }: Readonly<Props>) {
  return (
    <ul className="book-list" data-testid="book-list" aria-label="Books" aria-busy={busy}>
      {books.map((book) => (
        <BookRow key={book.id} book={book} onToggleAvailability={onToggleAvailability} onDelete={onDelete} />
      ))}
    </ul>
  );
}
