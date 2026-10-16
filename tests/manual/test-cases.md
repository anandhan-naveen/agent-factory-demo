# Manual test cases: Library Catalog

Overlap legend: **none** means only a human checks it. **partial** means automation asserts the logic but not the look, feel or assistive-tech experience. **full** means it is covered by automation, so it is listed here only for traceability and is not re-run manually.
Automation names are from `tests/ui/specs/*.spec.ts`. For ACs whose specs did not exist at the time of writing, the tag is given (e.g. `@FE-AC8`).

| ID | AC | Charter | Title | Steps (summary) | Expected | Automation overlap |
|---|---|---|---|---|---|---|
| MT-01 | FE-AC1 | C1 | Catalog visual polish at desktop | Open `#/` at 1280 px with seed data. Inspect the header, filter card and rows. | Even spacing. Badges and actions line up from row to row. Nothing truncated. Typography is consistent. | partial: `@FE-AC1 shows every book with title, author, genre, year and availability badge` (content only) |
| MT-02 | FE-AC11 | C1 | Mobile 360 px layout and wrapping | At 360 px, view the catalog. Add a book with a long hyphenated title and one with a 60-char unbroken title. | No horizontal page scroll. Titles and authors wrap inside the row. Action buttons stay reachable. | partial: `@FE-AC11` (scroll width only) |
| MT-03 | FE-AC10 / FE-AC11 | C1 | Dark colour scheme | Emulate `prefers-color-scheme: dark` at 360 and 1280 px. | The app either adapts or stays fully legible. No mixed or unreadable surfaces. | none |
| MT-04 | FE-AC1 | C4 | Loading indicator is perceptible on a slow network | QA URL: reload and capture within the 250 ms demo latency. (HTTP-mode QA only: API delayed 3 s, then Try again.) | "Loading books…" with a spinner is visible and centred. The heading reads "Books" and does not show a misleading 0. | partial: `@FE-AC1 shows a loading indicator while the request is in flight` |
| MT-05 | FE-AC2 | C5 | Search feel and data edge cases | Type "HISTORY", "le guin", whitespace only, then type fast and clear. On a slow API, type while rows are shown. | Case-insensitive title/author match. Whitespace means no filter (and no Reset link). No stale results. "Updating results…" shows while old rows stay. | partial: `@FE-AC2 search request is debounced by 300 ms`, `@FE-AC2 search matches …` |
| MT-06 | FE-AC4 | C1 | Empty-state copy and visuals | Search "zzzz-nothing" with genre Science. | Centred icon, "No books match your filters", a helpful hint and a "Clear filters" button. The count reads "0 books". | full (logic): `@FE-AC4 no matches shows "No books match your filters" with Clear filters`. Visual check is manual only. |
| MT-07 | FE-AC5 | C4 | Error-state copy and retry | QA URL: force a 201-char search (DOM setter) so the demo API returns 400. Read every message. Press Try again, then clear the search. (HTTP-mode QA only: API returns 503.) | Clear error with a Try again button. All other copy on the page stays truthful. Retry shows loading and then the data. | partial: `@FE-AC5 failed load shows an error with "Try again" that re-runs the request` |
| MT-08 | FE-AC6 | C1/C2 | Validation error presentation at 360 px (dark) | Submit with a blank title and author, ISBN `978-0-06-112008-5`, year 1449 and no genre. | Each error sits under its field with an icon. Red borders. Title gets focus. Copy is specific. Errors are linked via `aria-describedby`. | full (logic): `@FE-AC6 multiple errors: focus goes to the first in form order` and others. Presentation is manual only. |
| MT-09 | FE-AC7 | C1 | Duplicate ISBN message | Add a book using the seed ISBN `978-0061120084`. | "A book with this ISBN already exists" under ISBN. Focus on ISBN. Other fields keep their values. | partial: `@FE-AC7` |
| MT-10 | FE-AC7 | C2/C3 | Save success: return, toast and focus | Save a valid book with “typographic” quotes and an accented title, pressing Enter twice. | Returns to `#/` with a "Book added" toast that is announced politely. Exactly one new book is listed and the text is trimmed. Focus lands on the results heading. Ideally no full-list spinner and the new book is easy to find (D6). | partial: `@FE-AC7` (navigation and toast text) |
| MT-11 | FE-AC8, FE-AC10 | C2 | Toggle availability with the keyboard | Tab to "Mark on loan" and press Enter. | Badge updates in place. A toast confirms the change. **Keyboard focus stays on, or returns to, the toggle.** | partial: `@FE-AC8` (badge text only) |
| MT-12 | FE-AC9 | C2 | Delete confirm with the keyboard | Tab to Delete and press Enter. Check focus and the ring. Shift+Tab, Escape, then reopen and confirm. | Inline confirm (no dialog). Focus goes to Cancel (safe default) with a visible ring. Escape cancels and returns focus to Delete. After deleting, focus moves to the results heading and the count updates. | partial: `@FE-AC9` (removal only) |
| MT-13 | FE-AC10 | C2 | Keyboard-only journey and focus order | From page load, use Tab, Enter and Space through the skip link, filters, rows, Clear filters, Try again and the Add book form. | Logical order. Skip link works. A 3 px focus ring on every control. **Focus is never dropped to `<body>`.** | partial: `@FE-AC10 focus is kept on the page after Clear filters, Try again and saving a book`, `@FE-AC10 catalog controls are keyboard reachable with a visible focus ring` |
| MT-14 | FE-AC10 | C3 | Semantics: landmarks, headings, names, labels | Take an accessibility-tree snapshot of the catalog and the form. | header, main, footer and search landmarks. h1 > h2 (count) > h3 (titles). Row buttons named "Mark X as on loan" and "Delete X". Every field labelled. | none |
| MT-15 | FE-AC10 | C3 | Status announcements (live regions) | Watch the live regions while searching, getting zero results, loading, toggling and saving. | Result-count changes, the empty state and errors are announced (`role="status"` / `role="alert"`). The toast is announced politely. | partial: `@FE-AC10 result changes are announced: empty state is a status message` |
| MT-16 | FE-AC10 | C1 | Colour-contrast spot check | Compute contrast of the key text and button colours against their real backgrounds. | All text is at least 4.5:1, or at least 3:1 for large or bold text (WCAG AA). | none |
| MT-17 | FE-AC10 / FE-AC11 | C1 | Touch-target size at 360 px | Measure every interactive element's bounding box. | Targets are at least 24×24 px (WCAG 2.2 2.5.8), or the spacing exception applies. | none |
| MT-18 | FE-AC10 | C1 | Reduced motion | Emulate `prefers-reduced-motion: reduce`. | Transitions and animations are effectively disabled. | none |
| MT-19 | n/a (robustness) | C5 | Corrupt storage, unknown route, double submit, Back with a draft | Corrupt `library.demo.v1`. Open `#/does/not/exist`. Press Enter twice on save. Fill the form and press Back. | Reseeds 8 books. Redirects to `#/`. Only one book is created. Back navigates (draft loss is acceptable but noted). | none |
| MT-20 | Context (demo mode) | C5 | Demo badge and persistence | Check the badge and footer in demo mode (and in HTTP mode when an HTTP QA exists). Add, toggle and delete, then reload. | "Demo data" badge in demo mode only. Footer copy is true for the mode. Changes persist across a reload. | partial: `@FE-AC1` (seeded list) |
| MT-21 | FE-AC10 (WCAG 2.4.11) | C1/C2 | Toast does not hide the focused control | At 360 px, scroll so a row's toggle sits near the bottom of the viewport. Focus it and press Enter. | The focused toggle (and its ring) stays at least partly visible while the toast is shown. | none |
| MT-22 | FE-AC3 / FE-AC8 | C2/C5 | Toggle while filtered, rapid double toggle | (a) Turn on "Available only", press Enter on a toggle. (b) Click a toggle twice quickly, then reload. | (a) The row drops out, the count and live status update, focus lands on the results heading, not `<body>`. (b) Exactly one change is applied and persisted. | partial: `@FE-AC3 @FE-AC8 with "Available only" on, a book marked on loan drops out of the list` |

## Defect regression list

Re-test every one of these on each run and record fixed / still open in the run log.

| Defect | First found | Re-test with |
|---|---|---|
| D1 Toggle drops focus to `<body>` | 2026-10-14 | MT-11 |
| D2 Result count / empty state not announced | 2026-10-14 | MT-15 |
| D3 Focus lost after Clear filters, Try again, save | 2026-10-14 | MT-13, MT-07, MT-10 |
| D4 No dark colour scheme | 2026-10-14 | MT-03 |
| D5 Footer claims "Connected" while failing | 2026-10-14 | MT-07, MT-20 |
| D6 Full reload after save, new book not highlighted | 2026-10-14 | MT-10 |
| D7 Badge column misaligned / shifts on confirm | 2026-10-14 | MT-01, MT-12 |
| D8 "Available only" checkbox 20×20 px | 2026-10-14 | MT-17 |
| D9 Toast fully covers the focused toggle at 360 px | 2026-10-17 | MT-21 |
| D10 Load error shows raw API title "Validation failed" | 2026-10-17 | MT-07 |
