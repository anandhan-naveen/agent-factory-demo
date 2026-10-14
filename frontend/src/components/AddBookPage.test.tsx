import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { renderApp, stubApi } from '../test/helpers';

async function fill(user: UserEvent, values: Partial<Record<'title' | 'author' | 'isbn' | 'year', string>> & { genre?: string }) {
  if (values.title !== undefined) await user.type(screen.getByLabelText('Title'), values.title);
  if (values.author !== undefined) await user.type(screen.getByLabelText('Author'), values.author);
  if (values.isbn !== undefined) await user.type(screen.getByLabelText('ISBN-13'), values.isbn);
  if (values.year !== undefined) await user.type(screen.getByLabelText('Published year'), values.year);
  if (values.genre !== undefined) await user.selectOptions(screen.getByLabelText('Genre'), values.genre);
}

const VALID = { title: 'Dune', author: 'Frank Herbert', isbn: '978-0441172719', year: '1965', genre: 'FICTION' };

describe('AddBookPage', () => {
  it('opens from the catalog and cancels back', async () => {
    const { user } = renderApp(stubApi());
    await screen.findAllByTestId('book-row');
    await user.click(screen.getByRole('link', { name: 'Add book' }));
    const heading = screen.getByRole('heading', { level: 1, name: 'Add a book' });
    expect(heading).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  it('FE-AC6: shows every error under its field and focuses the first', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    await user.click(screen.getByRole('button', { name: 'Save book' }));

    expect(screen.getByTestId('error-title')).toHaveTextContent('Title is required');
    expect(screen.getByTestId('error-author')).toHaveTextContent('Author is required');
    expect(screen.getByTestId('error-isbn')).toHaveTextContent('ISBN is required');
    expect(screen.getByTestId('error-publishedYear')).toHaveTextContent('Published year is required');
    expect(screen.getByTestId('error-genre')).toHaveTextContent('Choose a genre');
    const title = screen.getByLabelText('Title');
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Title is required');
  });

  it('FE-AC6: rejects a bad ISBN checksum and focuses ISBN', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    await fill(user, { ...VALID, isbn: '9780441172710' });
    await user.click(screen.getByTestId('save-book'));
    expect(screen.getByTestId('error-isbn')).toHaveTextContent('invalid check digit');
    expect(screen.getByTestId('field-isbn')).toHaveFocus();
    expect(screen.queryByTestId('error-title')).not.toBeInTheDocument();
  });

  it('FE-AC6: rejects a year outside 1450..current year', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    const nextYear = String(new Date().getFullYear() + 1);
    await fill(user, { ...VALID, year: nextYear });
    await user.click(screen.getByTestId('save-book'));
    expect(screen.getByTestId('error-publishedYear')).toHaveTextContent('Enter a year between 1450 and');
    expect(screen.getByTestId('field-year')).toHaveFocus();
  });

  it('FE-AC7: saves, returns to the catalog, confirms and lists the new book', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    await fill(user, VALID);
    await user.click(screen.getByRole('button', { name: 'Save book' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent('Book added');
    // R-FE-05: focus lands on the results heading, not <body>.
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(9);
    });
    expect(screen.getByRole('heading', { level: 2, name: '9 books' })).toHaveFocus();
    const row = screen.getByRole('heading', { name: 'Dune', level: 3 }).closest('li');
    if (!row) throw new Error('row missing');
    expect(within(row).getByTestId('availability-badge')).toHaveTextContent('Available');
  });

  it('FE-AC7: shows the duplicate-ISBN message under the ISBN field', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    await fill(user, { ...VALID, isbn: '9780061120084' });
    await user.click(screen.getByTestId('save-book'));
    expect(await screen.findByTestId('error-isbn')).toHaveTextContent('A book with this ISBN already exists');
    expect(screen.getByTestId('field-isbn')).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Add a book' })).toBeInTheDocument();
    expect(screen.getByTestId('save-book')).toBeEnabled();
  });

  it('R-FE-12: does not truncate the year, so pasted padding is accepted and long values are reported', async () => {
    const { user } = renderApp(stubApi(), '/books/new');
    const year = screen.getByLabelText('Published year');
    expect(year).not.toHaveAttribute('maxLength');
    await fill(user, { ...VALID, year: '19655' });
    expect(year).toHaveValue('19655');
    await user.click(screen.getByTestId('save-book'));
    expect(screen.getByTestId('error-publishedYear')).toHaveTextContent('Enter a year between 1450 and');

    await user.clear(year);
    await user.click(year);
    await user.paste(' 1965 ');
    expect(year).toHaveValue(' 1965 ');
    await user.click(screen.getByTestId('save-book'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dune', level: 3 })).toBeInTheDocument();
  });

  it('maps server-side 400 field errors', async () => {
    const createBook = () => Promise.reject(new ApiError(400, 'Validation failed', { author: 'Author is blocked' }));
    const { user } = renderApp(stubApi({ createBook }), '/books/new');
    await fill(user, VALID);
    await user.click(screen.getByTestId('save-book'));
    expect(await screen.findByTestId('error-author')).toHaveTextContent('Author is blocked');
    expect(screen.getByTestId('field-author')).toHaveFocus();
  });

  it('shows a form-level alert for other failures', async () => {
    const createBook = () => Promise.reject(new ApiError(400, 'Validation failed', { unknownField: 'x' }, 'Request rejected'));
    const { user } = renderApp(stubApi({ createBook }), '/books/new');
    await fill(user, VALID);
    await user.click(screen.getByTestId('save-book'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save the book. Request rejected');
  });

  it('shows a generic alert for non-Error failures', async () => {
    const createBook = () => Promise.reject(new Error('Network down'));
    const { user } = renderApp(stubApi({ createBook }), '/books/new');
    await fill(user, VALID);
    await user.click(screen.getByTestId('save-book'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });
});
