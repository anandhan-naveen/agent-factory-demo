# Library Catalog — frontend

React 18 + TypeScript (strict) single-page app for browsing, searching and maintaining the library catalog.
Built with Vite, routed with `HashRouter` so the static build works on GitHub Pages.

## Run modes

| Mode | When | Data |
|---|---|---|
| **Demo** (default) | `VITE_API_BASE_URL` is unset or empty | In-browser mock API (`src/api/demoApi.ts`) seeded with 8 books, persisted to `localStorage` under `library.demo.v1`. Applies the same validation and 409 duplicate-ISBN rules as the backend. A **Demo data** badge is shown in the header. |
| **API** | `VITE_API_BASE_URL` is set, e.g. `http://localhost:8080` | Real Books API (`docs/api/openapi.yaml`) via `HttpBooksApi`. RFC 7807 problem responses map to `ApiError { status, title, errors }`. |

```bash
cp .env.example .env.local          # optional; leave VITE_API_BASE_URL empty for demo mode
npm ci
npm run dev                          # http://localhost:5173/#/
VITE_API_BASE_URL=http://localhost:8080 npm run dev   # against a running backend
```

To reset demo data, clear the `library.demo.v1` key in the browser's localStorage.

The backend must allow CORS from the dev/preview origin when running in API mode.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` → `dist/` (relative `base: './'`, deployable to any sub-path) |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm run lint` | ESLint 9 (typescript-eslint strict type-checked, react-hooks, jsx-a11y strict), `--max-warnings 0` |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm test` | Vitest + Testing Library (jsdom) |
| `npm run test:coverage` | Same, with v8 coverage; fails below 80 % lines/functions/statements or 75 % branches |

## Routes

- `#/` — Catalog: search (debounced 300 ms), genre filter, "Available only", toggle availability, inline delete confirm.
- `#/books/new` — Add book form with client-side validation (title 1–200, author 1–120, ISBN-13 checksum, year 1450–current, genre).

## Structure

```
src/
  api/        types.ts (OpenAPI mirror) · client.ts (BooksApi, HttpBooksApi, ApiError) · demoApi.ts · index.ts (mode switch)
  domain/     validation.ts (validateBook, isValidIsbn13) · genres.ts
  hooks/      useBooks.ts · useDebouncedValue.ts
  components/ CatalogPage, Filters, BookList/BookRow, AvailabilityBadge, DeleteConfirm, EmptyState, ErrorState, Toast, AddBookPage/BookForm
  test/       setup + helpers (MemoryStorage, stubApi, renderApp)
```

## UI automation contract

Stable `data-testid`s for Playwright (`tests/ui`): `search-input`, `genre-filter`, `available-only`, `book-list`,
`book-row` (+ `data-book-id`), `book-title`, `availability-badge`, `toggle-availability`, `delete-book`, `confirm-delete`,
`cancel-delete`, `add-book-button`, `empty-state`, `clear-filters`, `error-state`, `retry-button`, `loading`, `toast` (+ `data-kind`),
`results-status`, `load-more`,
`demo-badge`; form: `field-title`, `field-author`, `field-isbn`, `field-year`, `field-genre`, `save-book`, `cancel-book`,
`error-title|author|isbn|publishedYear|genre`. Prefer roles and labels; test ids are the fallback.

## Dependency note

The brief specified Vite 5 / Vitest 2. Both lines carry high/critical advisories with no in-major fix, which would fail
`npm audit --audit-level=high`, so the project pins **Vite 6.4.4** and **Vitest 4.1.11** (`@vitest/coverage-v8` 4.1.11).
The remaining advisories are 2 *moderate* ones in `react-router` 6 (fixed only in v7). The lockfile was generated with
npm 11 to sidestep an npm 10 resolver crash; `npm ci` works with npm 10 and 11.
