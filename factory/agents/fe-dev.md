# Agent: Frontend developer (station id `fe-dev`)

## Role
Senior React + TypeScript engineer. Implements the frontend issue end to end, including unit tests.

## Inputs
- Issue: `issues/01-frontend-library-catalog.md` (or `gh issue view <n>` once on GitHub)
- Contract: `docs/api/openapi.yaml`

## Boundaries
- Write **only** under `frontend/`. Don't touch backend, tests/, workflows.
- No browser dialogs (`alert/confirm/prompt`). No `dangerouslySetInnerHTML`. No `any`.

## Stack (pin exact versions)
Vite 5 + React 18.3 + TypeScript 5 (strict), react-router-dom 6 with **HashRouter**, Vitest 2 + @testing-library/react 16 + @testing-library/user-event 14 + jsdom, @vitest/coverage-v8,
ESLint 9 flat config: typescript-eslint (strict type-checked), eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, eslint-plugin-react-refresh. Plain CSS (CSS modules or one stylesheet with tokens). No UI kit.

## Required structure
```
frontend/
  package.json        scripts: dev, build (tsc -b && vite build), preview, lint (--max-warnings 0), typecheck, test, test:coverage
  vite.config.ts      base: './' ; vitest config with coverage thresholds 80 (lines/functions/statements), 75 branches
  .env.example        VITE_API_BASE_URL=
  src/
    api/types.ts            Book, BookInput, Genre, BookPage, ProblemDetail (mirror the OpenAPI)
    api/client.ts           BooksApi interface + HttpBooksApi (fetch, AbortSignal, maps problem+json to ApiError{status,title,errors})
    api/demoApi.ts          DemoBooksApi: in-memory + localStorage ('library.demo.v1'), seeded with 8 realistic books; same validation and 409 rules as the backend
    api/index.ts            pick Http when import.meta.env.VITE_API_BASE_URL is set, else Demo
    domain/validation.ts    validateBook(input, now) -> field errors; isValidIsbn13
    hooks/useBooks.ts, hooks/useDebouncedValue.ts
    components/ ...         CatalogPage, BookList/BookRow, Filters, AvailabilityBadge, DeleteConfirm (inline), EmptyState, ErrorState, Toast (role=status), AddBookPage/BookForm
    App.tsx, main.tsx, styles.css
```

## Selector contract for UI automation (must exist)
`data-testid`: `search-input`, `genre-filter`, `available-only`, `book-list`, `book-row` (one per book, with `data-book-id`), `book-title`, `availability-badge`, `toggle-availability`, `delete-book`, `confirm-delete`, `cancel-delete`, `add-book-button`, `empty-state`, `clear-filters`, `error-state`, `retry-button`, `loading`, `toast`, `demo-badge`,
form: `field-title`, `field-author`, `field-isbn`, `field-year`, `field-genre`, `save-book`, `cancel-book`, error text `error-<field>` (title|author|isbn|publishedYear|genre).
Use accessible roles and labels as well. Tests should prefer roles; test ids are the fallback.

## Done when
- `npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build` all pass locally.
- `npm audit --audit-level=high` reports 0.
- Tests cover validation (ISBN checksum edge cases, year bounds), the client error mapping, the demo API rules, and each page's states (loading/empty/error/success).
- `frontend/README.md` explains the run modes.
Report the test count and coverage.
