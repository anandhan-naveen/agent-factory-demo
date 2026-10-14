import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { expectNoSeriousA11yViolations, expectVisibleFocusRing } from '../support/assertions';
import { newBookInput, pick } from '../support/data';

/** Presses Tab until `target` is focused (max `limit` presses). Keyboard only, no clicks. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, `not reachable with Tab within ${String(limit)} presses`).toBeFocused();
}

test.describe('Accessibility (automatable part)', () => {
  test('@FE-AC10 axe: catalog page has no serious/critical violations', async ({ page, catalog }, testInfo) => {
    await catalog.open();
    await expectNoSeriousA11yViolations(page, testInfo, 'catalog');
  });

  test('@FE-AC10 axe: catalog empty state, delete confirm and toast', async ({ page, catalog, data }, testInfo) => {
    const book = pick(data.books);
    await catalog.open();
    await catalog.toggle(book.title).click();
    await expect(catalog.toast).toBeVisible();
    await catalog.deleteButton(book.title).click();
    await expectNoSeriousA11yViolations(page, testInfo, 'catalog-confirm-toast');
    await catalog.searchFor('zz-no-such-book-zz');
    await expect(catalog.emptyState).toBeVisible();
    await expectNoSeriousA11yViolations(page, testInfo, 'catalog-empty');
  });

  test('@FE-AC10 axe: catalog error state', async ({ page, catalog, mockApi }, testInfo) => {
    mockApi.failNext(500);
    await catalog.goto();
    await expect(catalog.errorState).toBeVisible();
    await expectNoSeriousA11yViolations(page, testInfo, 'catalog-error');
  });

  test('@FE-AC10 axe: add book page, pristine and with errors', async ({ page, addBook }, testInfo) => {
    await addBook.goto();
    await expect(addBook.heading).toBeVisible();
    await expectNoSeriousA11yViolations(page, testInfo, 'add-book');
    await addBook.save.click();
    await expect(addBook.error('title')).toBeVisible();
    await expectNoSeriousA11yViolations(page, testInfo, 'add-book-errors');
  });

  test('@FE-AC10 form fields have labels; status messages use status/alert roles', async ({ page, catalog, addBook, mockApi }) => {
    mockApi.delay(600);
    await catalog.goto();
    await expect(page.getByRole('status').filter({ hasText: 'Loading books' })).toBeVisible();
    mockApi.delay(0);
    await catalog.waitForSettled();
    for (const control of [catalog.search, catalog.genre, catalog.availableOnly]) await expect(control).toBeVisible();

    await addBook.goto();
    for (const name of ['Title', 'Author', 'ISBN-13', 'Published year'] as const) {
      await expect(page.getByRole('textbox', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('combobox', { name: 'Genre' })).toBeVisible();

    await addBook.fillBook(newBookInput());
    await addBook.save.click();
    await expect(page.getByRole('status').getByText('Book added')).toBeVisible();

    mockApi.failNext(500);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('We couldn’t load the catalog.');
  });

  test('@FE-AC10 result changes are announced: empty state is a status message', async ({ page, catalog, data }) => {
    // FINDINGS.md#F-01 (fixed): WCAG 4.1.3 Status Messages, result count and empty state are in a polite live region.
    await catalog.open();
    await expect(catalog.resultsStatus).toHaveAttribute('aria-live', 'polite');
    await expect(catalog.resultsStatus).toHaveText(`${String(data.books.length)} books found`);
    await catalog.searchFor('zz-no-such-book-zz');
    await expect(catalog.emptyState).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'No books match your filters' })).toBeVisible({ timeout: 2_000 });
    await expect(catalog.resultsStatus).toHaveText('No books match your filters');
  });

  test('@FE-AC10 focus is kept on the page after Clear filters, Try again and saving a book', async ({ catalog, addBook, mockApi }) => {
    await catalog.open();
    await catalog.searchFor('zz-no-such-book-zz');
    await catalog.clearFilters.click();
    await expect(catalog.search).toBeFocused();

    mockApi.failNext(500);
    await catalog.page.reload();
    await catalog.retry.click();
    await expect(catalog.resultsHeading).toBeFocused();
    await catalog.waitForSettled();

    await catalog.addBookLink.click();
    await addBook.fillBook(newBookInput());
    await addBook.save.click();
    await expect(catalog.heading).toBeVisible();
    await expect(catalog.resultsHeading).toBeFocused();
  });

  test('@FE-AC10 catalog controls are keyboard reachable with a visible focus ring', async ({ page, catalog, data }) => {
    const book = pick(data.books);
    await catalog.open();
    await page.locator('body').focus();
    for (const control of [catalog.search, catalog.genre, catalog.availableOnly, catalog.addBookLink, catalog.toggle(book.title), catalog.deleteButton(book.title)]) {
      await tabTo(page, control);
      await expectVisibleFocusRing(control);
    }
    // Toggle and delete-confirm work from the keyboard.
    await tabTo(page, catalog.toggle(book.title));
    await page.keyboard.press('Enter');
    await expect(catalog.badge(book.title)).toHaveText(book.available ? 'On loan' : 'Available');
    await tabTo(page, catalog.deleteButton(book.title));
    await page.keyboard.press('Enter');
    await expect(catalog.cancelDelete(book.title)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expectVisibleFocusRing(catalog.confirmDelete(book.title));
    await page.keyboard.press('Enter');
    await expect(catalog.row(book.title)).toHaveCount(0);
  });

  test('@FE-AC10 keyboard-only add-book flow', async ({ page, catalog, addBook, data }) => {
    const book = newBookInput({ title: data.titled('Keyboard Only'), genre: 'SCIENCE' });
    await catalog.open();
    await page.locator('body').focus();

    await tabTo(page, catalog.addBookLink);
    await expectVisibleFocusRing(catalog.addBookLink);
    await page.keyboard.press('Enter');
    await expect(addBook.heading).toBeFocused();

    // Submit empty with the keyboard: errors + focus on the first invalid field.
    await tabTo(page, addBook.save);
    await expectVisibleFocusRing(addBook.save);
    await page.keyboard.press('Enter');
    await expect(addBook.title).toBeFocused();
    await expectVisibleFocusRing(addBook.title);

    await page.keyboard.type(book.title);
    await page.keyboard.press('Tab');
    await expect(addBook.author).toBeFocused();
    await page.keyboard.type(book.author);
    await page.keyboard.press('Tab');
    await expect(addBook.isbn).toBeFocused();
    await page.keyboard.type(book.isbn);
    await page.keyboard.press('Tab');
    await expect(addBook.year).toBeFocused();
    await page.keyboard.type(String(book.publishedYear));
    await page.keyboard.press('Tab');
    await expectVisibleFocusRing(addBook.genre);
    // Type-ahead selection on a native <select>.
    await page.keyboard.type('Sci');
    await expect(addBook.genre).toHaveValue('SCIENCE');
    await page.keyboard.press('Tab');
    await expect(addBook.save).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#\/$/);
    await expect(catalog.toast).toContainText('Book added');
    await expect(catalog.row(book.title)).toBeVisible();
  });
});
