import { expect, test } from '../fixtures/test';

test.describe('API failure', () => {
  test('@FE-AC5 failed load shows an error with "Try again" that re-runs the request', async ({ catalog, mockApi }) => {
    mockApi.failNext(500);
    await catalog.goto();
    await expect(catalog.errorState).toBeVisible();
    await expect(catalog.errorState).toContainText('We couldn’t load the catalog.');
    await expect(catalog.retry).toBeVisible();
    await expect(catalog.rows).toHaveCount(0);
    expect(mockApi.listRequests()).toHaveLength(1);

    await catalog.retry.click();
    await expect(catalog.errorState).toHaveCount(0);
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
    expect(mockApi.listRequests()).toHaveLength(2);
  });

  test('@FE-AC5 retry keeps working after repeated failures', async ({ catalog, mockApi }) => {
    mockApi.failNext(503, 2);
    await catalog.goto();
    await expect(catalog.errorState).toBeVisible();
    await catalog.retry.click();
    await expect.poll(() => mockApi.listRequests().length).toBe(2);
    await expect(catalog.errorState).toBeVisible();
    await catalog.retry.click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });

  test('@FE-AC5 failure while filtering: Try again re-runs the same filtered query', async ({ catalog, mockApi }) => {
    await catalog.open();
    mockApi.failNext(500);
    await catalog.filterGenre('HISTORY');
    await expect(catalog.errorState).toBeVisible();

    await catalog.retry.click();
    await expect.poll(() => catalog.titles()).toEqual(['The Guns of August']);
    const requests = mockApi.listRequests();
    expect(requests.at(-1)?.url.searchParams.get('genre')).toBe('HISTORY');
    expect(requests.at(-2)?.url.searchParams.get('genre')).toBe('HISTORY');
  });

  test('@FE-AC5 network failure (no response) shows the error state', async ({ page, catalog, mockApi }) => {
    await page.route((url) => url.pathname === '/api/books', (route) => route.abort('internetdisconnected'), { times: 1 });
    await catalog.goto();
    await expect(catalog.errorState).toBeVisible();
    await expect(catalog.errorState).toContainText('We couldn’t reach the catalog service. Check your connection and try again.');
    await catalog.retry.click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });

  // BUG-39 (QA run 2026-10-17, D10): a 400 on the list showed the raw problem title "Validation failed"
  // with only "Try again", which repeats the same failing request.
  test('@BUG-39 @FE-AC5 400 caused by the search shows plain copy and Clear filters recovers the list', async ({ page, catalog, mockApi }) => {
    await catalog.open();
    const all = mockApi.snapshot().length;
    mockApi.failNextWith({ status: 400, title: 'Validation failed', errors: { q: 'Search must be 200 characters or fewer' } });
    await catalog.searchFor('a search the backend rejects');
    await expect(catalog.errorState).toBeVisible();
    await expect(catalog.errorState).toContainText('We couldn’t load the catalog.');
    await expect(catalog.errorState).toContainText('Your search is too long. Shorten it and try again.');
    await expect(catalog.errorState).not.toContainText('Validation failed');
    expect(mockApi.listRequests().at(-1)?.url.searchParams.get('q')).toBe('a search the backend rejects');

    const clear = catalog.errorState.getByRole('button', { name: 'Clear filters' });
    await expect(clear).toBeVisible();
    await expect(catalog.retry).toBeVisible();
    await clear.click();
    await expect(catalog.errorState).toHaveCount(0);
    await expect(catalog.rows).toHaveCount(all);
    await expect(catalog.search).toHaveValue('');
    await expect(catalog.search).toBeFocused();
    expect(mockApi.listRequests().at(-1)?.url.searchParams.has('q')).toBe(false);
    await expect(page.getByText('Validation failed')).toHaveCount(0);
  });

  test('@BUG-39 @FE-AC5 400 caused by another filter shows plain filter copy, never the problem title', async ({ catalog, mockApi }) => {
    await catalog.open();
    mockApi.failNextWith({ status: 400, title: 'Validation failed', errors: { genre: 'must be one of FICTION, …' } });
    await catalog.filterGenre('HISTORY');
    await expect(catalog.errorState).toContainText('Some filters aren’t valid. Clear the filters and try again.');
    await expect(catalog.errorState).not.toContainText('Validation failed');
    await catalog.errorState.getByRole('button', { name: 'Clear filters' }).click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
    await expect(catalog.genre).toHaveValue('');
    await expect(catalog.search).toBeFocused();
  });

  test('@BUG-39 @FE-AC5 500 shows generic copy without the server title and no Clear filters', async ({ catalog, mockApi }) => {
    mockApi.failNextWith({ status: 500, title: 'Internal Server Error', detail: 'NullPointerException at BookService' });
    await catalog.goto();
    await expect(catalog.errorState).toBeVisible();
    await expect(catalog.errorState).toContainText('Something went wrong on our side. Try again in a moment.');
    await expect(catalog.errorState).not.toContainText('Internal Server Error');
    await expect(catalog.errorState).not.toContainText('NullPointerException');
    await expect(catalog.errorState.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await catalog.retry.click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });
});
