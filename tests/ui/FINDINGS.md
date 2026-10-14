# UI automation findings

Product issues found while automating `issues/01-frontend-library-catalog.md`.
Tests covering a confirmed bug are marked `test.fail()` and link here; once fixed, the test will
start "unexpectedly passing" and the `test.fail()` must be removed.

## F-01 (fixed in review round 1, R-FE-04)

| | |
|---|---|
| **AC** | FE-AC10 (status messages use `role="status"` / `role="alert"`); WCAG 2.1 SC 4.1.3 Status Messages (AA) |
| **Severity** | Medium (screen-reader users only) |
| **Test** | `specs/accessibility.spec.ts` › `@FE-AC10 result changes are announced: empty state is a status message` (`test.fail` removed, passes) |
| **Status** | Fixed: `CatalogPage` renders an always-mounted visually hidden `role="status" aria-live="polite"` region (`data-testid="results-status"`) with "N books found" / "No books match your filters". |

**Steps**
1. Open the catalog (`#/`).
2. Type `zz-no-such-book-zz` into Search.

**Expected:** the "No books match your filters" message (and, ideally, the result count) is exposed in a live region (`role="status"`) so assistive technology announces the outcome of the search without moving focus.

**Actual:** the empty state (`data-testid="empty-state"`, `components/EmptyState.tsx`) and the "N books" heading are plain content; nothing is announced. Loading, toast and error state do use `status` / `alert` correctly.

**Suggested fix:** give the empty state `role="status"` (or render a visually hidden live region with the result count in `CatalogPage`).

---

## Observations (not failing tests, for product owner triage)

- **O-01 – "Available only" + "Mark on loan" (resolved, R-FE-08: the row now drops out and focus moves to the results heading; `specs/availability.spec.ts`):** with "Available only" checked, marking a book on loan keeps the row in the list (now showing "On loan") until the filters change. This matches FE-AC8 ("badge updates without a full reload") but is inconsistent with the active filter. Decide whether the row should drop out.
