import { forwardRef, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { ApiError } from '../api/client';
import { GENRES, type BookInput } from '../api/types';
import { GENRE_LABELS } from '../domain/genres';
import {
  AUTHOR_MAX,
  BOOK_FIELDS,
  DUPLICATE_ISBN_MESSAGE,
  MIN_YEAR,
  TITLE_MAX,
  firstInvalidField,
  toBookInput,
  validateBook,
  type BookField,
  type FieldErrors,
} from '../domain/validation';

interface FormValues {
  title: string;
  author: string;
  isbn: string;
  publishedYear: string;
  genre: string;
}

const EMPTY: FormValues = { title: '', author: '', isbn: '', publishedYear: '', genre: '' };

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  field: BookField;
  label: string;
  hint?: string;
  error?: string;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ field, label, hint, error, ...rest }, ref) {
  const id = `book-${field}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <input
        {...rest}
        ref={ref}
        id={id}
        name={field}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-testid={`field-${field === 'publishedYear' ? 'year' : field}`}
      />
      {error ? (
        <p className="field__error" id={`${id}-error`} data-testid={`error-${field}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
});

/** Maps a failed save to field-level errors (409 duplicate ISBN, 400 field errors), or null for anything else. */
function fieldErrorsFromSaveError(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 409) return { isbn: DUPLICATE_ISBN_MESSAGE };
  if (error.status !== 400) return null;
  const next: FieldErrors = {};
  for (const field of BOOK_FIELDS) {
    const message = error.errors[field];
    if (message) next[field] = message;
  }
  return firstInvalidField(next) ? next : null;
}

interface Props {
  onSave: (input: BookInput) => Promise<void>;
  onCancel: () => void;
  now?: () => Date;
}

export function BookForm({ onSave, onCancel, now = () => new Date() }: Readonly<Props>) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const isbnRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLSelectElement>(null);
  const refs = { title: titleRef, author: authorRef, isbn: isbnRef, publishedYear: yearRef, genre: genreRef };

  function focusFirst(fieldErrors: FieldErrors): void {
    const first = firstInvalidField(fieldErrors);
    if (first) refs[first].current?.focus();
  }

  function update(field: keyof FormValues, value: string): void {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const fieldErrors = validateBook(values, now());
    setErrors(fieldErrors);
    if (firstInvalidField(fieldErrors)) {
      focusFirst(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await onSave(toBookInput(values));
    } catch (error) {
      setSaving(false);
      const next = fieldErrorsFromSaveError(error);
      if (next) {
        setErrors(next);
        focusFirst(next);
        return;
      }
      setFormError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form className="form" noValidate onSubmit={(e) => void handleSubmit(e)} aria-labelledby="add-book-heading">
      {formError ? (
        <div className="form__alert" role="alert">
          <strong>Couldn’t save the book.</strong> {formError}
        </div>
      ) : null}

      <TextField
        ref={titleRef}
        field="title"
        label="Title"
        error={errors.title}
        value={values.title}
        maxLength={TITLE_MAX + 50}
        autoComplete="off"
        onChange={(e) => {
          update('title', e.target.value);
        }}
      />
      <TextField
        ref={authorRef}
        field="author"
        label="Author"
        error={errors.author}
        value={values.author}
        maxLength={AUTHOR_MAX + 50}
        autoComplete="off"
        onChange={(e) => {
          update('author', e.target.value);
        }}
      />
      <div className="form__row">
        <TextField
          ref={isbnRef}
          field="isbn"
          label="ISBN-13"
          hint="13 digits; hyphens are fine"
          error={errors.isbn}
          value={values.isbn}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            update('isbn', e.target.value);
          }}
        />
        <TextField
          ref={yearRef}
          field="publishedYear"
          label="Published year"
          hint={`${String(MIN_YEAR)} – ${String(now().getFullYear())}`}
          error={errors.publishedYear}
          value={values.publishedYear}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            update('publishedYear', e.target.value);
          }}
        />
      </div>
      <div className={`field${errors.genre ? ' field--invalid' : ''}`}>
        <label className="field__label" htmlFor="book-genre">
          Genre
        </label>
        <select
          ref={genreRef}
          id="book-genre"
          name="genre"
          className="input select"
          value={values.genre}
          aria-invalid={errors.genre ? true : undefined}
          aria-describedby={errors.genre ? 'book-genre-error' : undefined}
          onChange={(e) => {
            update('genre', e.target.value);
          }}
          data-testid="field-genre"
        >
          <option value="">Select a genre</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {GENRE_LABELS[g]}
            </option>
          ))}
        </select>
        {errors.genre ? (
          <p className="field__error" id="book-genre-error" data-testid="error-genre">
            {errors.genre}
          </p>
        ) : null}
      </div>

      <div className="form__actions">
        <button type="submit" className="button button--primary button--lg" disabled={saving} data-testid="save-book">
          {saving ? 'Saving…' : 'Save book'}
        </button>
        <button type="button" className="button button--ghost button--lg" onClick={onCancel} disabled={saving} data-testid="cancel-book">
          Cancel
        </button>
      </div>
    </form>
  );
}
