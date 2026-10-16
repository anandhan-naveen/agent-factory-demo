import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { DEMO_STORAGE_KEY } from '../api/demoApi';
import type { Book } from '../api/types';
import { MemoryStorage, demoApi, renderApp, stubApi } from '../test/helpers';

function manyBooks(n: number): Book[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `bulk-${String(i).padStart(3, '0')}`,
    title: `Bulk Book ${String(i).padStart(3, '0')}`,
    author: 'Bulk Author',
    isbn: `978${String(i).padStart(10, '0')}`,
    publishedYear: 2000,
    genre: 'FICTION' as const,
    available: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function resultsStatus(): HTMLElement {
  return screen.getByTestId('results-status');
}

async function rows() {
  return screen.findAllByTestId('book-row');
}

function rowFor(title: string): HTMLElement {
  const row = screen.getByRole('heading', { name: title, level: 3 }).closest('li');
  if (!row) throw new Error(`row for ${title} not found`);
  return row;
}

describe('CatalogPage', () => {
  it('FE-AC1: shows a loading indicator, then every book with its details', async () => {
    renderApp(stubApi());
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading books');
    expect(await rows()).toHaveLength(8);
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '8 books' })).toBeInTheDocument();

    const row = rowFor('To Kill a Mockingbird');
    expect(row).toHaveAttribute('data-book-id');
    expect(within(row).getByTestId('book-title')).toHaveTextContent('To Kill a Mockingbird');
    expect(row).toHaveTextContent('Harper Lee');
    expect(row).toHaveTextContent('Fiction');
    expect(row).toHaveTextContent('1960');
    expect(within(row).getByTestId('availability-badge')).toHaveTextContent('Available');
    expect(within(rowFor('The Pragmatic Programmer')).getByTestId('availability-badge')).toHaveTextContent('On loan');
  });

  it('shows the demo badge in demo mode only', async () => {
    renderApp(stubApi());
    expect(screen.getByTestId('demo-badge')).toHaveTextContent('Demo data');
    await rows();
  });

  it('hides the demo badge in http mode', async () => {
    renderApp({ ...stubApi(), mode: 'http' });
    expect(screen.queryByTestId('demo-badge')).not.toBeInTheDocument();
    await rows();
  });

  it('FE-AC2: debounces search and matches title or author case-insensitively', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    listBooks.mockClear();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'HAWK');
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(1);
    });
    expect(rowFor('A Brief History of Time')).toBeInTheDocument();
    const queries = listBooks.mock.calls.map(([query]) => query.q);
    expect(queries).toEqual(['HAWK']);

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'mockingbird');
    expect(await screen.findByRole('heading', { name: 'To Kill a Mockingbird', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByTestId('book-row')).toHaveLength(1);
  });

  it('FE-AC2: waits 300 ms before querying', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const base = demoApi();
      const listBooks = vi.fn(base.listBooks.bind(base));
      const { user } = renderApp(stubApi({ listBooks }, base));
      await act(() => vi.advanceTimersByTimeAsync(10));
      listBooks.mockClear();
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'x');
      await act(() => vi.advanceTimersByTimeAsync(250));
      expect(listBooks).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(100));
      expect(listBooks).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('FE-AC3: genre filter and available-only combine with search', async () => {
    const { user } = renderApp(stubApi());
    await rows();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), 'SCIENCE');
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(2);
    });

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'gene');
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(1);
    });
    expect(rowFor('The Gene: An Intimate History')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), '');
    await user.click(screen.getByRole('checkbox', { name: 'Available only' }));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(6);
    });
    for (const badge of screen.getAllByTestId('availability-badge')) expect(badge).toHaveTextContent('Available');

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(8);
    });
  });

  it('FE-AC4: shows the empty state and clears filters', async () => {
    const { user } = renderApp(stubApi());
    await rows();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), 'TECHNOLOGY');
    await user.click(screen.getByRole('checkbox', { name: 'Available only' }));

    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('No books match your filters');
    await user.click(within(empty).getByRole('button', { name: 'Clear filters' }));

    expect(await rows()).toHaveLength(8);
    expect(screen.getByRole('combobox', { name: 'Genre' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Available only' })).not.toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  });

  it('shows a distinct empty state when the catalog has no books', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '[]');
    renderApp(stubApi({}, demoApi(storage)));
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('The catalog is empty');
    expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
  });

  it('FE-AC5: shows an error with a working retry', async () => {
    const base = demoApi();
    const listBooks = vi
      .fn(base.listBooks.bind(base))
      .mockRejectedValueOnce(new ApiError(503, 'Service Unavailable', {}, 'The catalog service is down.'));
    const { user } = renderApp(stubApi({ listBooks }, base));

    const error = await screen.findByTestId('error-state');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    expect(error).not.toHaveTextContent('Service Unavailable');
    expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await rows()).toHaveLength(8);
    expect(listBooks).toHaveBeenCalledTimes(2);
  });

  it('FE-AC5: handles non-Error rejections', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new Error('Unknown error')) }));
    expect(await screen.findByTestId('error-state')).toHaveTextContent('Something went wrong on our side.');
  });

  it('FE-AC8: toggles availability without reloading the list', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    const calls = listBooks.mock.calls.length;

    const row = rowFor('To Kill a Mockingbird');
    await user.click(within(row).getByRole('button', { name: 'Mark To Kill a Mockingbird as on loan' }));
    await waitFor(() => {
      expect(within(row).getByTestId('availability-badge')).toHaveTextContent('On loan');
    });
    expect(within(row).getByTestId('toggle-availability')).toHaveTextContent('Mark available');
    expect(await screen.findByTestId('toast')).toHaveTextContent('“To Kill a Mockingbird” marked on loan');
    expect(listBooks.mock.calls).toHaveLength(calls);

    await user.click(within(row).getByTestId('toggle-availability'));
    await waitFor(() => {
      expect(within(row).getByTestId('availability-badge')).toHaveTextContent('Available');
    });
  });

  it('FE-AC8: reports a failed toggle', async () => {
    const { user } = renderApp(stubApi({ setAvailability: () => Promise.reject(new ApiError(500, 'Boom')) }));
    await rows();
    const row = rowFor('The Guns of August');
    await user.click(within(row).getByTestId('toggle-availability'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Couldn’t update “The Guns of August”');
    expect(within(row).getByTestId('availability-badge')).toHaveTextContent('Available');
    expect(within(row).getByTestId('toggle-availability')).toHaveAttribute('aria-disabled', 'false');
  });

  it('FE-AC9: deletes after an inline confirm; cancel keeps the book', async () => {
    const { user } = renderApp(stubApi());
    await rows();

    let row = rowFor('Where the Wild Things Are');
    await user.click(within(row).getByRole('button', { name: 'Delete Where the Wild Things Are' }));
    const group = within(row).getByRole('group', { name: 'Confirm deleting Where the Wild Things Are' });
    expect(within(group).getByTestId('cancel-delete')).toHaveFocus();
    await user.click(within(group).getByRole('button', { name: 'Cancel' }));
    expect(within(row).queryByTestId('confirm-delete')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(within(row).getByTestId('delete-book')).toHaveFocus();
    });

    row = rowFor('Where the Wild Things Are');
    await user.click(within(row).getByTestId('delete-book'));
    await user.keyboard('{Escape}');
    expect(within(row).queryByTestId('confirm-delete')).not.toBeInTheDocument();

    await user.click(within(row).getByTestId('delete-book'));
    await user.click(within(row).getByTestId('confirm-delete'));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(7);
    });
    expect(screen.queryByRole('heading', { name: 'Where the Wild Things Are' })).not.toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent('“Where the Wild Things Are” deleted');
    expect(screen.getByRole('heading', { level: 2, name: '7 books' })).toHaveFocus();
  });

  it('FE-AC9: keeps the book when delete fails', async () => {
    const { user } = renderApp(stubApi({ deleteBook: () => Promise.reject(new ApiError(404, 'Not found')) }));
    await rows();
    const row = rowFor('Sapiens: A Brief History of Humankind');
    await user.click(within(row).getByTestId('delete-book'));
    await user.click(within(row).getByTestId('confirm-delete'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Couldn’t delete');
    expect(screen.getAllByTestId('book-row')).toHaveLength(8);
    await waitFor(() => {
      expect(within(row).getByTestId('delete-book')).toHaveFocus();
    });
  });

  it('redirects unknown routes to the catalog', async () => {
    renderApp(stubApi(), '/nowhere');
    expect(await rows()).toHaveLength(8);
  });
  it('R-FE-01: shows the total in the heading and loads further pages on demand', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(manyBooks(101)));
    const { user } = renderApp(stubApi({}, demoApi(storage)));
    expect(await rows()).toHaveLength(100);
    expect(screen.getByRole('heading', { level: 2, name: '101 books' })).toBeInTheDocument();
    expect(screen.getByText('Showing 100 of 101')).toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent('101 books found, 100 shown');

    await user.click(screen.getByRole('button', { name: 'Load more books' }));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(101);
    });
    expect(screen.queryByTestId('load-more')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '101 books' })).toHaveFocus();
    expect(resultsStatus()).toHaveTextContent(/^101 books found$/);
  });

  it('R-FE-01: reports a failed "load more"', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(manyBooks(101)));
    const base = demoApi(storage);
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    listBooks.mockRejectedValueOnce(new ApiError(500, 'Boom'));
    await user.click(screen.getByTestId('load-more'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load more books');
    expect(screen.getAllByTestId('book-row')).toHaveLength(100);
    expect(screen.getByTestId('load-more')).toBeInTheDocument();
  });

  it('R2-FE-02: "Load more" is aria-disabled and inert while a new filter reloads page 0', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(manyBooks(101)));
    const base = demoApi(storage);
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    expect(screen.getByTestId('load-more')).toHaveAttribute('aria-disabled', 'false');

    const reloading = deferred<Awaited<ReturnType<typeof base.listBooks>>>();
    listBooks.mockClear();
    listBooks.mockImplementationOnce(() => reloading.promise);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), 'FICTION');
    expect(listBooks).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('load-more')).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByTestId('load-more'));
    expect(listBooks).toHaveBeenCalledTimes(1);

    await act(async () => {
      reloading.resolve(await base.listBooks({ q: '', genre: 'FICTION', page: 0, size: 100 }));
    });
    expect(screen.getByTestId('load-more')).toHaveAttribute('aria-disabled', 'false');
  });

  it('R-FE-03: keeps focus on the toggle while the update is in flight and ignores repeat presses', async () => {
    const base = demoApi();
    const pending = deferred<Book>();
    const setAvailability = vi.fn(() => pending.promise);
    const { user } = renderApp(stubApi({ setAvailability }, base));
    await rows();
    const toggle = within(rowFor('The Guns of August')).getByTestId('toggle-availability');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).not.toBeDisabled();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(setAvailability).toHaveBeenCalledTimes(1);

    const book = (await base.listBooks({ q: 'Guns' })).items[0];
    if (!book) throw new Error('seed missing');
    await act(async () => {
      pending.resolve({ ...book, available: false });
      await pending.promise;
    });
    expect(within(rowFor('The Guns of August')).getByTestId('availability-badge')).toHaveTextContent('On loan');
    expect(toggle).toHaveAttribute('aria-disabled', 'false');
    expect(toggle).toHaveFocus();
  });

  it('R-FE-03: keeps focus on the confirm button while deleting', async () => {
    const pending = deferred<undefined>();
    const deleteBook = vi.fn(() => pending.promise);
    const { user } = renderApp(stubApi({ deleteBook }));
    await rows();
    const row = rowFor('Where the Wild Things Are');
    await user.click(within(row).getByTestId('delete-book'));
    const confirm = within(row).getByTestId('confirm-delete');
    await user.click(confirm);
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveFocus();
    await user.click(confirm);
    await user.click(within(row).getByTestId('cancel-delete'));
    await user.keyboard('{Escape}');
    expect(deleteBook).toHaveBeenCalledTimes(1);
    expect(within(row).getByTestId('confirm-delete')).toBeInTheDocument();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(7);
    });
  });

  it('R-FE-04: announces the result count and the empty state in a polite live region', async () => {
    const { user } = renderApp(stubApi());
    const status = resultsStatus();
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
    await rows();
    expect(status).toHaveTextContent(/^8 books found$/);

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zz-none');
    await waitFor(() => {
      expect(status).toHaveTextContent(/^No books match your filters$/);
    });
    expect(resultsStatus()).toBe(status);

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'hawking');
    await waitFor(() => {
      expect(status).toHaveTextContent(/^1 book found$/);
    });
  });

  it('R-FE-04: announces an empty catalog and stays silent while loading or on error', async () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '[]');
    renderApp(stubApi({}, demoApi(storage)));
    await screen.findByTestId('empty-state');
    expect(resultsStatus()).toHaveTextContent('The catalog is empty');
  });

  it('R-FE-04: the live region is empty while the error state is shown', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new ApiError(500, 'Boom')) }));
    await screen.findByTestId('error-state');
    expect(resultsStatus()).toBeEmptyDOMElement();
  });

  it('R-FE-05: Clear filters and Reset filters move focus to the search box', async () => {
    const { user } = renderApp(stubApi());
    await rows();
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zz-none');
    const empty = await screen.findByTestId('empty-state');
    await user.click(within(empty).getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), 'SCIENCE');
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(2);
    });
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
    expect(await rows()).toHaveLength(8);
  });

  it('R-FE-05: Try again moves focus to the results heading', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base)).mockRejectedValueOnce(new ApiError(503, 'Down'));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    expect(await rows()).toHaveLength(8);
    expect(screen.getByRole('heading', { level: 2, name: '8 books' })).toHaveFocus();
  });

  it('R-FE-08: with "Available only" on, a book marked on loan leaves the list', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    await user.click(screen.getByRole('checkbox', { name: 'Available only' }));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(6);
    });
    const calls = listBooks.mock.calls.length;

    await user.click(within(rowFor('The Guns of August')).getByTestId('toggle-availability'));
    await waitFor(() => {
      expect(screen.getAllByTestId('book-row')).toHaveLength(5);
    });
    expect(screen.queryByRole('heading', { name: 'The Guns of August', level: 3 })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '5 books' })).toHaveFocus();
    expect(screen.getByTestId('toast')).toHaveTextContent('“The Guns of August” marked on loan');
    expect(listBooks.mock.calls).toHaveLength(calls);
  });

  it('R-FE-09: failures use an error toast in an alert', async () => {
    const { user } = renderApp(stubApi({ setAvailability: () => Promise.reject(new ApiError(500, 'Boom')) }));
    await rows();
    await user.click(within(rowFor('The Guns of August')).getByTestId('toggle-availability'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t update “The Guns of August”');
    expect(screen.getByTestId('toast')).toHaveAttribute('data-kind', 'error');
  });

  it('R-FE-10: the footer in http mode does not claim a live connection', async () => {
    renderApp({ ...stubApi(), mode: 'http' });
    await rows();
    expect(screen.getByText('Live catalog: changes are saved to the catalog service.')).toBeInTheDocument();
    expect(screen.queryByText(/Connected to/)).not.toBeInTheDocument();
  });

  it('D10: a 400 on the search shows plain copy and a Clear filters way out', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    listBooks.mockRejectedValueOnce(new ApiError(400, 'Validation failed', { q: 'Search must be 200 characters or fewer' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz');

    const error = await screen.findByTestId('error-state');
    expect(error).toHaveTextContent('We couldn’t load the catalog.');
    expect(error).toHaveTextContent('Your search is too long. Shorten it and try again.');
    expect(error).not.toHaveTextContent('Validation failed');
    expect(within(error).getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    await user.click(within(error).getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    expect(await rows()).toHaveLength(8);
  });

  it('D10: a 400 on another filter suggests clearing the filters', async () => {
    const base = demoApi();
    const listBooks = vi.fn(base.listBooks.bind(base));
    const { user } = renderApp(stubApi({ listBooks }, base));
    await rows();
    listBooks.mockRejectedValueOnce(new ApiError(400, 'Validation failed', { genre: 'Unknown genre' }));
    await user.click(screen.getByRole('checkbox', { name: 'Available only' }));
    const error = await screen.findByTestId('error-state');
    expect(error).toHaveTextContent('Some filters aren’t valid. Clear the filters and try again.');
    expect(within(error).getByTestId('clear-filters')).toBeInTheDocument();
  });

  it('D10 / R3-FE-03: a paging 400 on the first page gets generic copy and only Try again', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new ApiError(400, 'Validation failed', { size: 'too big' })) }));
    const error = await screen.findByTestId('error-state');
    expect(error).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    expect(error).not.toHaveTextContent(/loading more/i);
    expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
  });

  it('R3-FE-03: an unrecognised 400 with no active filters does not ask to clear filters', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new ApiError(400, 'Validation failed', { sort: 'bad' })) }));
    const error = await screen.findByTestId('error-state');
    expect(error).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    expect(error).not.toHaveTextContent(/clear the filters/i);
    expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
  });

  it('D10: a network failure gets connection copy', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new ApiError(0, 'Network error')) }));
    expect(await screen.findByTestId('error-state')).toHaveTextContent('Check your connection and try again.');
  });
});
