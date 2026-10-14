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
    await expect(catalog.errorState).toContainText('Could not reach the catalog server');
    await catalog.retry.click();
    await expect(catalog.rows).toHaveCount(mockApi.snapshot().length);
  });
});
