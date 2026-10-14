---
title: "[FE] Library Catalog screen: browse, search and add books"
labels: [frontend, user-story]
---

## User story

**As a** librarian
**I want** a catalog screen where I can browse, search, filter and add books, and mark them as on loan or available
**So that** I can keep the library's catalog up to date without using a spreadsheet.

## Context

- Tech: React 18 + TypeScript (Vite), React Router (hash routing so it works on GitHub Pages).
- Backend: consumes the Books REST API from the backend issue. Contract: `docs/api/openapi.yaml`.
- When `VITE_API_BASE_URL` is not set, the app runs in **demo mode** with an in-browser mock API (seeded with sample books) and shows a small "Demo data" badge. This lets the GitHub Pages build work without a backend.

## Screens

1. **Catalog** (`#/`): page title, search box, genre filter, "Available only" toggle, list of books, "Add book" button.
2. **Add book** (`#/books/new`): form with Title, Author, ISBN-13, Published year, Genre. Save / Cancel.

## Acceptance criteria

| ID | Criterion |
|---|---|
| FE-AC1 | On load, the catalog shows every book with title, author, genre, published year and an availability badge ("Available" / "On loan"). A loading indicator shows while the request is in flight. |
| FE-AC2 | Typing in the search box filters by title **or** author (case-insensitive). The request is debounced by 300 ms. |
| FE-AC3 | The genre filter (All + 6 genres) and the "Available only" toggle narrow the list and combine with the search. |
| FE-AC4 | If no books match, an empty state reads "No books match your filters" and offers a "Clear filters" button. |
| FE-AC5 | If the API fails, an error message is shown with a "Try again" button that re-runs the request. |
| FE-AC6 | The Add book form validates on submit: title 1–200 chars, author 1–120 chars, ISBN-13 with a valid checksum, year between 1450 and the current year, genre required. Each error appears under its field and the first invalid field gets focus. |
| FE-AC7 | Saving a valid book returns to the catalog, shows a "Book added" confirmation and lists the new book. A duplicate ISBN (409) shows "A book with this ISBN already exists" under the ISBN field. |
| FE-AC8 | Each book has a toggle to mark it "On loan" / "Available". The badge updates without a full reload. |
| FE-AC9 | Each book has a Delete action with an in-page confirm step (no browser dialogs). Confirming removes it from the list. |
| FE-AC10 | Accessibility: all controls are keyboard reachable with a visible focus ring, form fields have labels, status messages use `role="status"` / `role="alert"`, colour contrast meets WCAG AA. |
| FE-AC11 | Layout works from 360 px to desktop width with no horizontal page scroll. |

## Testing (Definition of Done)

- **Unit tests** (Vitest + React Testing Library) for components, validation and the API client. Line coverage ≥ 80 %.
- **UI automation** (Playwright, `tests/ui`): one or more automated scenarios per acceptance criterion FE-AC1 … FE-AC9 and FE-AC11, tagged with the AC id. Runs against the demo-mode build in CI.
- **Manual testing** (`tests/manual`): test charter covering what automation does not, e.g. screen-reader announcement (FE-AC10), visual polish, keyboard-only flow, slow network, and a run log template.
- ESLint + TypeScript strict pass with zero warnings. `npm audit --audit-level=high` clean.
