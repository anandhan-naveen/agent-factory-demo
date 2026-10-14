import { test, expect } from './support/fixtures';

test.describe('health', () => {
  test('@BE-health actuator health reports UP', async ({ request }) => {
    const res = await request.get('/actuator/health');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/json/);
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe('UP');
  });

  test('@BE-AC1 the catalog is seeded with at least one book', async ({ request }) => {
    const res = await request.get('/api/books');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { totalItems: number; items: unknown[] };
    expect(body.totalItems).toBeGreaterThanOrEqual(1);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });
});
