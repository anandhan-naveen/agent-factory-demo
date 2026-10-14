import { expect, type Locator, type Page } from '@playwright/test';
import type { Genre } from '../support/types';

export class CatalogPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly genre: Locator;
  readonly availableOnly: Locator;
  readonly addBookLink: Locator;
  readonly list: Locator;
  readonly rows: Locator;
  readonly loading: Locator;
  readonly emptyState: Locator;
  readonly clearFilters: Locator;
  readonly errorState: Locator;
  readonly retry: Locator;
  readonly toast: Locator;
  readonly resultsHeading: Locator;
  /** Always-mounted visually hidden live region announcing the result count / empty state. */
  readonly resultsStatus: Locator;
  readonly loadMore: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Catalog' });
    this.search = page.getByRole('searchbox', { name: 'Search' });
    this.genre = page.getByRole('combobox', { name: 'Genre' });
    this.availableOnly = page.getByRole('checkbox', { name: 'Available only' });
    this.addBookLink = page.getByRole('link', { name: 'Add book' });
    this.list = page.getByTestId('book-list');
    this.rows = this.list.getByTestId('book-row');
    this.loading = page.getByTestId('loading');
    this.emptyState = page.getByTestId('empty-state');
    this.clearFilters = page.getByRole('button', { name: 'Clear filters' });
    this.errorState = page.getByRole('alert').and(page.getByTestId('error-state'));
    this.retry = page.getByRole('button', { name: 'Try again' });
    // The toast's message lives in a status (success) or alert (error) region; its dismiss button sits outside it.
    this.toast = page.getByTestId('toast');
    this.resultsHeading = page.getByRole('heading', { level: 2 });
    this.resultsStatus = page.getByRole('status').and(page.getByTestId('results-status'));
    this.loadMore = page.getByRole('button', { name: 'Load more books' });
  }

  async goto(): Promise<void> {
    await this.page.goto('./#/');
  }

  /** Navigates and waits until the first list (or empty/error state) has rendered. */
  async open(): Promise<void> {
    await this.goto();
    await this.waitForSettled();
  }

  async waitForSettled(): Promise<void> {
    await expect(this.loading).toHaveCount(0);
    await expect(this.list.or(this.emptyState).or(this.errorState)).toBeVisible();
  }

  row(title: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
  }

  badge(title: string): Locator {
    return this.row(title).getByTestId('availability-badge');
  }

  toggle(title: string): Locator {
    return this.row(title).getByTestId('toggle-availability');
  }

  deleteButton(title: string): Locator {
    return this.row(title).getByRole('button', { name: `Delete ${title}`, exact: true });
  }

  confirmDelete(title: string): Locator {
    return this.row(title).getByRole('group', { name: `Confirm deleting ${title}` }).getByTestId('confirm-delete');
  }

  cancelDelete(title: string): Locator {
    return this.row(title).getByRole('group', { name: `Confirm deleting ${title}` }).getByTestId('cancel-delete');
  }

  async titles(): Promise<string[]> {
    return this.rows.getByTestId('book-title').allInnerTexts();
  }

  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
  }

  async filterGenre(genre: Genre | ''): Promise<void> {
    await this.genre.selectOption(genre);
  }
}
