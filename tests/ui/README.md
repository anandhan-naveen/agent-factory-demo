# UI automation – Library Catalog (`tests/ui`)

Playwright Test + TypeScript (strict) + `@axe-core/playwright`, covering FE-AC1 … FE-AC11 of
[`issues/01-frontend-library-catalog.md`](../../issues/01-frontend-library-catalog.md).

## How it runs

- `playwright.config.ts` builds the real frontend with `VITE_API_BASE_URL=http://api.test` into `tests/ui/.app-dist`
  (never into `frontend/`) and serves it with `vite preview` on port 4173 (`UI_TEST_PORT` to change).
- The `backend` fixture (auto) routes `http://api.test/api/books**` to an in-memory implementation of
  [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) (`fixtures/mockApi.ts`): list/search/genre/available/paging,
  create with validation (400) and duplicate ISBN (409), PATCH availability, DELETE, CORS preflight.
  The app's real `HttpBooksApi` is exercised end to end.
- `mockApi.failNext(status, times?)` injects problem+json errors, `mockApi.delay(ms)` adds latency,
  `mockApi.requests` / `listRequests()` expose the HTTP traffic for assertions.
- `demo` project (R-FE-02): the same frontend is also built with an **empty** `VITE_API_BASE_URL` (exactly what the
  GitHub Pages job deploys) into `tests/ui/.app-dist-demo` and served on port 4174 (`UI_TEST_PORT + 1`). The smoke specs
  in `demo/` (fixtures in `fixtures/demo.ts`) cover FE-AC1–4 and 7–9, the demo badge and persistence across reloads;
  localStorage is cleared once per test, and any request to a books API fails the test.
- Page objects: `pages/CatalogPage.ts`, `pages/AddBookPage.ts` (roles/labels first, `data-testid` fallback).
- Every test title carries its AC tag, e.g. `@FE-AC6`. Run one AC with `npx playwright test -g @FE-AC6`.

### Integration mode (optional)

```bash
E2E_REAL_API=http://localhost:8080 npx playwright test   # project "integration", no route mocking
```
The `data` fixture seeds the real backend through the API with a per-test tag in every title, and deletes them afterwards.
Tests that use `mockApi` (error injection, latency, request inspection, exact catalog contents) are skipped in this mode.
The backend must allow CORS from `http://localhost:4173`.

## Commands

```bash
cd tests/ui
npm ci
npm run lint        # eslint, --max-warnings 0 (typescript-eslint strict + eslint-plugin-playwright)
npm run typecheck   # tsc --noEmit, strict
npx playwright test # builds + serves both apps, runs the chromium (mocked) and demo projects
npx playwright show-report
```

Browsers: locally Chromium comes from `PLAYWRIGHT_BROWSERS_PATH` (`@playwright/test` is pinned to **1.56.1**, which matches
`chromium-1194`; `playwright-core` is overridden to the same version for `@axe-core/playwright`). In CI run
`npx playwright install --with-deps chromium` first. The frontend's own `node_modules` must be installed (`npm ci` in `frontend/`).
Traces, screenshots and videos are kept on failure (`test-results/`); CI also writes `test-results/junit.xml`.

## AC → test traceability

| AC | Spec | Tests |
|---|---|---|
| FE-AC1 list + loading | `specs/catalog-list.spec.ts` | every book shows title/author/genre/year/badge · both badge variants · loading indicator (`role=status`) while in flight · exact list in API order + count heading · single GET on load · 101 books: heading shows the total, "Load more" fetches page 1 |
| FE-AC2 search, debounce | `specs/search-filter.spec.ts` | author match, case-insensitive · author search returns only matches · title match, case-insensitive (`q` sent as typed) · 300 ms debounce with `page.clock` (no request at 299 ms, exactly one at 300 ms, one request for a burst of keystrokes) |
| FE-AC3 genre + available | `specs/search-filter.spec.ts` | All + 6 genres · genre narrows (`genre=` param) · Available only (`available=true`) · search + genre + availability combine |
| FE-AC4 empty state | `specs/search-filter.spec.ts` | "No books match your filters" + Clear filters restores list and resets every control · Clear filters resets genre/availability and query params |
| FE-AC5 error + retry | `specs/error-state.spec.ts` | 500 on load → alert + Try again re-requests · repeated failures · failure while filtering retries same query · network failure (aborted request) |
| FE-AC6 validation | `specs/add-book-validation.spec.ts` | empty submit: 5 messages, focus Title, no POST · bad ISBN checksum focuses ISBN · ISBN length/characters · title 1–200 · author 1–120 · year 1450–current (incl. non-numeric) · genre required · boundary values accepted + hyphenated ISBN normalised · first invalid field in form order gets focus |
| FE-AC7 save + 409 | `specs/add-book-save.spec.ts` | save returns to catalog, "Book added", new row listed · normalised POST payload · 409 → "A book with this ISBN already exists" under ISBN, focused · 400 field errors mapped under fields · 500 → form alert · Cancel saves nothing |
| FE-AC8 availability | `specs/availability.spec.ts` | toggle on loan ↔ available, no reload (window marker) · PATCH body, no list refetch, other rows untouched · failed PATCH keeps badge · with "Available only" on, a book marked on loan drops out |
| FE-AC9 delete | `specs/delete.spec.ts` | in-page confirm (no browser dialogs, asserted for every test) then removal · DELETE request + count heading · cancel by click and Escape, focus restored · failed DELETE keeps row |
| FE-AC10 a11y (automatable) | `specs/accessibility.spec.ts` | axe WCAG 2.1 A/AA (no serious/critical, incl. colour contrast) on catalog, confirm+toast, empty, error, add page pristine + with errors · labelled fields, `status`/`alert` roles · result count and empty state announced in a live region (F-01, fixed) · focus kept after Clear filters / Try again / save · all catalog controls Tab-reachable with visible focus ring, toggle/delete by keyboard · keyboard-only add-book flow |
| Demo build (Pages) | `demo/demo-smoke.spec.ts` | demo badge + seed list · search · genre/available · empty state + Clear filters · add, toggle, delete each persisted across reload · no API requests |
| FE-AC11 responsive | `specs/responsive.spec.ts` | 360 / 768 / 1280 px: catalog (list, confirm, toast, empty) and add form (with errors) have `scrollWidth <= clientWidth` · 360 px long unbroken title + error state |

Manual follow-up for FE-AC10 (screen-reader announcements, focus ring visual quality) lives in `tests/manual`.

## Findings

See [`FINDINGS.md`](FINDINGS.md). **F-01** (FE-AC10, empty state not announced) and observation O-01 are both fixed.
