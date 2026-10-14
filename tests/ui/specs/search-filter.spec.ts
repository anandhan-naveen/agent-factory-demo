import { expect, test } from '../fixtures/test';
import { GENRE_LABELS, GENRES } from '../support/types';

test.describe('Search', () => {
  test('@FE-AC2 search matches author case-insensitively', async ({ catalog, data }) => {
    await catalog.open();
    await catalog.searchFor('hArPeR lEe');
    await expect(catalog.row(data.titled('To Kill a Mockingbird'))).toBeVisible();
    await expect(catalog.row(data.titled('A Brief History of Time'))).toHaveCount(0);
  });

  test('@FE-AC2 author search returns only matching books', async ({ catalog }) => {
    await catalog.open();
    await catalog.searchFor('HARPER');
    await expect.poll(() => catalog.titles()).toEqual(['To Kill a Mockingbird']);
  });

  test('@FE-AC2 search matches title case-insensitively', async ({ catalog, mockApi }) => {
    await catalog.open();
    await catalog.searchFor('BRIEF HISTORY');
    await expect.poll(() => catalog.titles()).toEqual(['Sapiens: A Brief History of Humankind', 'A Brief History of Time']);
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('q')).toBe('BRIEF HISTORY');
  });

  test('@FE-AC2 search request is debounced by 300 ms', async ({ page, catalog, mockApi }) => {
    await page.clock.install();
    await catalog.open();
    const initial = mockApi.listRequests().length;
    // Freeze page time so only clock.runFor() advances the debounce timer.
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1_000);

    // Typing several characters in quick succession must produce a single request.
    await catalog.search.pressSequentially('harper');
    const early = page.waitForRequest((r) => r.url().includes('q='), { timeout: 750 }).catch(() => null);
    await page.clock.runFor(299);
    expect(await early, 'no search request before 300 ms').toBeNull();
    expect(mockApi.listRequests()).toHaveLength(initial);

    await page.clock.runFor(1);
    await expect.poll(() => mockApi.listRequests().length).toBe(initial + 1);
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('q')).toBe('harper');
    await expect(catalog.row('To Kill a Mockingbird')).toBeVisible();
    await expect(catalog.rows).toHaveCount(1);

    // A further pause does not produce extra requests.
    await page.clock.runFor(1_000);
    expect(mockApi.listRequests()).toHaveLength(initial + 1);
  });
});

test.describe('Filters', () => {
  test('@FE-AC3 genre filter offers All + 6 genres', async ({ catalog }) => {
    await catalog.open();
    await expect(catalog.genre.locator('option')).toHaveText(['All genres', ...GENRES.map((g) => GENRE_LABELS[g])]);
    await expect(catalog.genre).toHaveValue('');
  });

  test('@FE-AC3 genre filter narrows the list', async ({ catalog, mockApi }) => {
    await catalog.open();
    await catalog.filterGenre('SCIENCE');
    await expect.poll(() => catalog.titles()).toEqual(['A Brief History of Time', 'The Gene: An Intimate History']);
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('genre')).toBe('SCIENCE');

    await catalog.filterGenre('');
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });

  test('@FE-AC3 "Available only" hides books on loan', async ({ catalog, mockApi }) => {
    await catalog.open();
    await catalog.availableOnly.check();
    const expected = mockApi.snapshot().filter((b) => b.available).map((b) => b.title);
    await expect.poll(() => catalog.titles()).toEqual(expected);
    await expect(catalog.rows.getByTestId('availability-badge')).toHaveText(expected.map(() => 'Available'));
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('available')).toBe('true');

    await catalog.availableOnly.uncheck();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
    expect(mockApi.listRequests().at(-1)?.url.searchParams.has('available')).toBe(false);
  });

  test('@FE-AC3 search, genre and availability combine', async ({ catalog, mockApi }) => {
    await catalog.open();
    await catalog.searchFor('history');
    await expect.poll(() => catalog.titles()).toEqual(['Sapiens: A Brief History of Humankind', 'A Brief History of Time', 'The Gene: An Intimate History']);

    await catalog.filterGenre('SCIENCE');
    await expect.poll(() => catalog.titles()).toEqual(['A Brief History of Time', 'The Gene: An Intimate History']);

    await catalog.filterGenre('FICTION');
    await catalog.searchFor('the');
    await catalog.availableOnly.check();
    // FICTION + "the" matches only "The Left Hand of Darkness", which is on loan.
    await expect
      .poll(() => Object.fromEntries(mockApi.listRequests().at(-1)?.url.searchParams ?? []))
      .toMatchObject({ q: 'the', genre: 'FICTION', available: 'true' });
    await expect(catalog.emptyState).toContainText('No books match your filters');

    await catalog.availableOnly.uncheck();
    await expect.poll(() => catalog.titles()).toEqual(['The Left Hand of Darkness']);
    const last = mockApi.listRequests().at(-1)?.url.searchParams;
    expect(last?.get('q')).toBe('the');
    expect(last?.get('genre')).toBe('FICTION');
  });
});

test.describe('Empty state', () => {
  test('@FE-AC4 no matches shows "No books match your filters" with Clear filters', async ({ catalog, data }) => {
    await catalog.open();
    await catalog.searchFor('zz-no-such-book-zz');
    await expect(catalog.emptyState).toBeVisible();
    await expect(catalog.emptyState).toContainText('No books match your filters');
    await expect(catalog.rows).toHaveCount(0);
    await expect(catalog.clearFilters).toBeVisible();

    await catalog.clearFilters.click();
    await expect(catalog.search).toHaveValue('');
    await expect(catalog.genre).toHaveValue('');
    await expect(catalog.availableOnly).not.toBeChecked();
    await expect(catalog.emptyState).toHaveCount(0);
    for (const book of data.books) await expect(catalog.row(book.title)).toBeVisible();
  });

  test('@FE-AC4 Clear filters resets genre and availability too', async ({ catalog, mockApi }) => {
    await catalog.open();
    await catalog.filterGenre('CHILDREN');
    await catalog.availableOnly.check();
    await catalog.searchFor('darkness');
    await expect(catalog.emptyState).toContainText('No books match your filters');

    await catalog.clearFilters.click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
    await expect(catalog.genre).toHaveValue('');
    await expect(catalog.availableOnly).not.toBeChecked();
    const last = mockApi.listRequests().at(-1)?.url.searchParams;
    expect([...(last?.keys() ?? [])].filter((k) => k !== 'page' && k !== 'size')).toEqual([]);
  });
});
