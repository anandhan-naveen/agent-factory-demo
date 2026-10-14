import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { DEMO_STORAGE_KEY } from '../api/demoApi';
import { MemoryStorage, demoApi, renderApp, stubApi } from '../test/helpers';

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

    const error = await screen.findByRole('alert');
    expect(error).toHaveAttribute('data-testid', 'error-state');
    expect(error).toHaveTextContent('The catalog service is down.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await rows()).toHaveLength(8);
    expect(listBooks).toHaveBeenCalledTimes(2);
  });

  it('FE-AC5: handles non-Error rejections', async () => {
    renderApp(stubApi({ listBooks: () => Promise.reject(new Error('Unknown error')) }));
    expect(await screen.findByTestId('error-state')).toHaveTextContent('Unknown error');
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
    expect(listBooks.mock.calls.length).toBe(calls);

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
    expect(within(row).getByTestId('toggle-availability')).toBeEnabled();
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
});
