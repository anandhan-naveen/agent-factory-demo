import { test, expect, BOOKS, expectJson, expectProblem } from './support/fixtures';
import { uniqueToken, type BookPage } from './support/data';

const titlesOf = (page: BookPage): string[] => page.items.map((b) => b.title);

test.describe('GET /api/books – paging and sorting', () => {
  test('@BE-AC1 returns a page envelope with default page 0 and size 20', async ({ request }) => {
    const page = await expectJson<BookPage>(await request.get(BOOKS), 200, 'BookPage');
    expect(page.page).toBe(0);
    expect(page.size).toBe(20);
    expect(page.items.length).toBeLessThanOrEqual(20);
    expect(page.totalPages).toBe(Math.ceil(page.totalItems / page.size));
  });

  test('@BE-AC1 sorts by title case-insensitively', async ({ request, books }) => {
    const token = uniqueToken();
    await books.create({ title: `banana ${token}` });
    await books.create({ title: `Apple ${token}` });
    await books.create({ title: `cherry ${token}` });
    await books.create({ title: `Avocado ${token}` });

    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token } }), 200, 'BookPage');
    expect(titlesOf(page)).toEqual([`Apple ${token}`, `Avocado ${token}`, `banana ${token}`, `cherry ${token}`]);
  });

  test('@BE-AC1 the unfiltered first page is ordered by title ignoring case', async ({ request }) => {
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { size: 100 } }), 200, 'BookPage');
    const titles = titlesOf(page).map((t) => t.toLowerCase());
    for (let i = 1; i < titles.length; i++) {
      expect((titles[i - 1] ?? '') <= (titles[i] ?? ''), `"${titles[i - 1]}" should sort before "${titles[i]}"`).toBe(true);
    }
  });

  test('@BE-AC1 pages through results with page and size', async ({ request, books }) => {
    const token = uniqueToken();
    for (const t of ['a', 'b', 'c']) await books.create({ title: `${t} ${token}` });

    const first = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, size: 2, page: 0 } }), 200, 'BookPage');
    expect(first).toMatchObject({ page: 0, size: 2, totalItems: 3, totalPages: 2 });
    expect(titlesOf(first)).toEqual([`a ${token}`, `b ${token}`]);

    const second = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, size: 2, page: 1 } }), 200, 'BookPage');
    expect(second).toMatchObject({ page: 1, size: 2, totalItems: 3, totalPages: 2 });
    expect(titlesOf(second)).toEqual([`c ${token}`]);

    const beyond = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, size: 2, page: 5 } }), 200, 'BookPage');
    expect(beyond.items).toEqual([]);
    expect(beyond.totalItems).toBe(3);
  });

  test('@BE-AC1 accepts the maximum page size of 100', async ({ request }) => {
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { size: 100 } }), 200, 'BookPage');
    expect(page.size).toBe(100);
  });

  const badPaging: Record<string, string | number>[] = [{ size: 101 }, { size: 1000 }, { size: 0 }, { size: -1 }, { page: -1 }, { size: 'abc' }, { page: 'x' }];
  for (const params of badPaging) {
    test(`@BE-AC1 rejects out-of-range paging ${JSON.stringify(params)} with 400`, async ({ request }) => {
      await expectProblem(await request.get(BOOKS, { params }), 400);
    });
  }

  test('@BE-AC1 a page whose row offset overflows a 32-bit int is a 400 on page, not a 500', async ({ request }) => {
    // 21474837 * 100 > 2^31 - 1
    const problem = await expectProblem(await request.get(BOOKS, { params: { page: 21474837, size: 100 } }), 400);
    expect(problem.errors?.page).toBeTruthy();
  });

  test('@BE-AC1 the largest page whose offset fits is an empty 200 page', async ({ request }) => {
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { page: 21474836, size: 100 } }), 200, 'BookPage');
    expect(page.items).toEqual([]);
  });
});

test.describe('GET /api/books – search and filters', () => {
  test('@BE-AC2 q matches a case-insensitive substring of the title', async ({ request, books }) => {
    const token = uniqueToken();
    const hit = await books.create({ title: `The ${token.toUpperCase()} Chronicles` });
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token.slice(1, 8) } }), 200, 'BookPage');
    expect(page.items.map((b) => b.id)).toContain(hit.id);
  });

  test('@BE-AC2 q matches a case-insensitive substring of the author', async ({ request, books }) => {
    const token = uniqueToken();
    const hit = await books.create({ author: `Ada ${token}son` });
    const miss = await books.create({ author: 'Somebody Else' });
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token.toUpperCase() } }), 200, 'BookPage');
    const ids = page.items.map((b) => b.id);
    expect(ids).toEqual([hit.id]);
    expect(ids).not.toContain(miss.id);
  });

  test('@BE-AC2 q with no match returns an empty page', async ({ request }) => {
    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: uniqueToken() } }), 200, 'BookPage');
    expect(page).toMatchObject({ items: [], totalItems: 0 });
  });

  test('@BE-AC2 genre filters by exact enum value', async ({ request, books }) => {
    const token = uniqueToken();
    const sci = await books.create({ title: `Sci ${token}`, genre: 'SCIENCE' });
    await books.create({ title: `Hist ${token}`, genre: 'HISTORY' });

    const page = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, genre: 'SCIENCE' } }), 200, 'BookPage');
    expect(page.items.map((b) => b.id)).toEqual([sci.id]);

    const all = await expectJson<BookPage>(await request.get(BOOKS, { params: { genre: 'SCIENCE', size: 100 } }), 200, 'BookPage');
    expect(all.items.every((b) => b.genre === 'SCIENCE')).toBe(true);
  });

  test('@BE-AC2 rejects a genre that is not in the enum', async ({ request }) => {
    await expectProblem(await request.get(BOOKS, { params: { genre: 'POETRY' } }), 400);
  });

  test('@BE-AC2 available filters by availability', async ({ request, books }) => {
    const token = uniqueToken();
    const onShelf = await books.create({ title: `On ${token}` });
    const loaned = await books.create({ title: `Out ${token}` });
    const patch = await request.patch(`${BOOKS}/${loaned.id}/availability`, { data: { available: false } });
    expect(patch.status()).toBe(200);

    const avail = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, available: true } }), 200, 'BookPage');
    expect(avail.items.map((b) => b.id)).toEqual([onShelf.id]);

    const out = await expectJson<BookPage>(await request.get(BOOKS, { params: { q: token, available: false } }), 200, 'BookPage');
    expect(out.items.map((b) => b.id)).toEqual([loaned.id]);
    expect(out.items.every((b) => !b.available)).toBe(true);
  });

  test('@BE-AC2 q, genre and available combine', async ({ request, books }) => {
    const token = uniqueToken();
    const match = await books.create({ title: `Match ${token}`, genre: 'TECHNOLOGY' });
    await books.create({ title: `Wrong genre ${token}`, genre: 'CHILDREN' });
    const loaned = await books.create({ title: `Loaned ${token}`, genre: 'TECHNOLOGY' });
    await books.create({ title: 'Unrelated title', author: 'Nobody', genre: 'TECHNOLOGY' });
    expect((await request.patch(`${BOOKS}/${loaned.id}/availability`, { data: { available: false } })).status()).toBe(200);

    const page = await expectJson<BookPage>(
      await request.get(BOOKS, { params: { q: token, genre: 'TECHNOLOGY', available: true } }),
      200,
      'BookPage',
    );
    expect(page.items.map((b) => b.id)).toEqual([match.id]);
    expect(page.totalItems).toBe(1);
  });
});
