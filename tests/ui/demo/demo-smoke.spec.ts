import { expect, test } from '../fixtures/demo';
import { newBookInput } from '../support/data';
import { DEMO_SEED } from '../support/demoData';
import { GENRE_LABELS } from '../support/types';

// Smoke subset against the demo-mode build that GitHub Pages deploys (no backend, data in localStorage).
test.describe('Demo build (GitHub Pages)', () => {
  test('@demo @FE-AC1 shows the demo badge and every seed book with its details', async ({ page, catalog }) => {
    await catalog.open();
    await expect(page.getByTestId('demo-badge')).toHaveText('Demo data');
    await expect(page.getByRole('contentinfo')).toContainText('Demo mode');
    await expect(catalog.resultsHeading).toHaveText(`${String(DEMO_SEED.length)} books`);
    expect(await catalog.titles()).toEqual(DEMO_SEED.map((b) => b.title));
    for (const book of DEMO_SEED) {
      const row = catalog.row(book.title);
      await expect(row).toContainText(book.author);
      await expect(row).toContainText(GENRE_LABELS[book.genre]);
      await expect(row).toContainText(String(book.publishedYear));
      await expect(row.getByTestId('availability-badge')).toHaveText(book.available ? 'Available' : 'On loan');
    }
  });

  test('@demo @FE-AC2 search matches title or author, case-insensitively', async ({ catalog }) => {
    await catalog.open();
    await catalog.searchFor('HAWKING');
    await expect(catalog.rows).toHaveCount(1);
    await expect(catalog.row('A Brief History of Time')).toHaveCount(1);
    await catalog.searchFor('mockingbird');
    await expect(catalog.rows).toHaveCount(1);
    await expect(catalog.row('To Kill a Mockingbird')).toHaveCount(1);
  });

  test('@demo @FE-AC3 genre and "Available only" combine with the search', async ({ catalog }) => {
    await catalog.open();
    await catalog.filterGenre('SCIENCE');
    await expect(catalog.rows).toHaveCount(DEMO_SEED.filter((b) => b.genre === 'SCIENCE').length);
    await catalog.filterGenre('');
    await catalog.availableOnly.check();
    await expect(catalog.rows).toHaveCount(DEMO_SEED.filter((b) => b.available).length);
    await catalog.filterGenre('FICTION');
    await catalog.searchFor('guin');
    await expect(catalog.rows).toHaveCount(1);
    await expect(catalog.row('The Left Hand of Darkness')).toHaveCount(1);
  });

  test('@demo @FE-AC4 empty state and Clear filters', async ({ catalog }) => {
    await catalog.open();
    await catalog.filterGenre('TECHNOLOGY');
    await catalog.availableOnly.check();
    await expect(catalog.emptyState).toContainText('No books match your filters');
    await expect(catalog.resultsStatus).toHaveText('No books match your filters');
    await catalog.clearFilters.click();
    await expect(catalog.rows).toHaveCount(DEMO_SEED.length);
    await expect(catalog.genre).toHaveValue('');
    await expect(catalog.availableOnly).not.toBeChecked();
    await expect(catalog.search).toBeFocused();
  });

  test('@demo @FE-AC7 adding a book lists it and it survives a reload', async ({ page, catalog, addBook }) => {
    const book = newBookInput({ title: 'Demo Smoke Volume', genre: 'HISTORY' });
    await catalog.open();
    await catalog.addBookLink.click();
    await addBook.fillBook(book);
    await addBook.save.click();

    await expect(catalog.toast).toContainText('Book added');
    await expect(catalog.row(book.title)).toHaveCount(1);
    await expect(catalog.badge(book.title)).toHaveText('Available');
    await expect(catalog.resultsHeading).toHaveText(`${String(DEMO_SEED.length + 1)} books`);

    await page.reload();
    await catalog.waitForSettled();
    await expect(catalog.row(book.title)).toHaveCount(1);
    await expect(catalog.rows).toHaveCount(DEMO_SEED.length + 1);
  });

  test('@demo @FE-AC8 toggling availability updates the badge and survives a reload', async ({ page, catalog }) => {
    await catalog.open();
    await catalog.toggle('To Kill a Mockingbird').click();
    await expect(catalog.badge('To Kill a Mockingbird')).toHaveText('On loan');
    await expect(catalog.toast).toContainText('marked on loan');

    await page.reload();
    await catalog.waitForSettled();
    await expect(catalog.badge('To Kill a Mockingbird')).toHaveText('On loan');
  });

  test('@demo @FE-AC9 deleting after the in-page confirm removes the book, also after a reload', async ({ page, catalog }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      void dialog.dismiss();
    });
    await catalog.open();
    await catalog.deleteButton('Where the Wild Things Are').click();
    await catalog.confirmDelete('Where the Wild Things Are').click();
    await expect(catalog.row('Where the Wild Things Are')).toHaveCount(0);
    await expect(catalog.resultsHeading).toHaveText(`${String(DEMO_SEED.length - 1)} books`);

    await page.reload();
    await catalog.waitForSettled();
    await expect(catalog.row('Where the Wild Things Are')).toHaveCount(0);
    await expect(catalog.rows).toHaveCount(DEMO_SEED.length - 1);
    expect(dialogs).toEqual([]);
  });
});
