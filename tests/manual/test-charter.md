# Manual test charter: Library Catalog (FE issue 01)

Scope: `issues/01-frontend-library-catalog.md`, FE-AC1 to FE-AC11, run against the **demo-mode build** (`npm run build && npx vite preview`).
The UI automation in `tests/ui` (tagged `@FE-ACx`) checks the functional logic. These sessions cover what automation judges poorly: how the app looks and reads, keyboard and screen-reader experience, how it feels on a slow network, and exploratory edge cases.

Heuristics used: **SFDIPOT** (Structure, Function, Data, Interfaces, Platform, Operations, Time) for coverage. **CRUSSPIC STMPL** quality criteria, mainly Capability, Usability, Accessibility (under Usability), Performance-as-perceived and Compatibility. **Consistency oracles**: the issue text, the app's own copy, WCAG 2.2 AA and comparable catalog UIs.

Setup notes:
- Demo mode: run `npx vite build` with no `VITE_API_BASE_URL`. Data lives in `localStorage` key `library.demo.v1`. Clear it to reseed the 8 sample books.
- Error and slow network: build with `VITE_API_BASE_URL=http://127.0.0.1:9/api` and intercept the API in the browser (Playwright `page.route` or DevTools request blocking). Return 503 to get an error, or delay about 3 s to get slow responses. The demo API has no failure switch, so this is the only way to see FE-AC5 in a real browser.
- Viewports: 360×780 (small phone) and 1280×860 (desktop). Colour schemes: light and dark (`prefers-color-scheme`).

---

## Charter C1: Visual polish and responsive layout (60 min)
**Mission:** Explore the catalog and Add book screens at 360 px and 1280 px, in light and dark schemes, to find alignment, truncation, wrapping, spacing and contrast problems.
**Areas:** masthead and demo badge, page header, filter card, book rows (badge column, action buttons), empty and error states, form layout (the ISBN/year row), toast placement.
**Data/ideas:** very long titles, both with hyphens and as a single unbroken token. Long author names. The 8 seed books. A list longer than one screen.
**Heuristics:** Structure, Platform. Consistency with the app's own design system. "No horizontal scroll" (FE-AC11).
**Out of scope:** pixel-diff baselines (not automated here).

## Charter C2: Keyboard-only journey (45 min)
**Mission:** Do the whole librarian workflow with the keyboard only: search, filter, toggle availability, delete with confirm, add a book with errors and then fix them. Find focus traps, focus loss and missing or invisible focus rings.
**Areas:** skip link, tab order, focus after async actions (toggle, delete, clear filters, retry, save), the Escape key on the delete confirm, initial focus on Add book.
**Heuristics:** Operations ("a librarian at the desk with a scanner and keyboard"). Interfaces. WCAG 2.4.3 Focus Order, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured.

## Charter C3: Screen-reader semantics and announcements (45 min)
**Mission:** Check that a screen-reader user gets the same information and feedback as a sighted user.
**Areas:** landmarks, heading outline, accessible names of row buttons, labels and descriptions on form fields, live regions (toast, loading, result count, empty state, error), `aria-busy`.
**Method:** the accessibility-tree snapshot (`page.accessibility.snapshot()`), role queries, and NVDA/VoiceOver spot checks where available.
**Heuristics:** Usability/Accessibility (WCAG 1.3.1, 4.1.2, 4.1.3 Status Messages).

## Charter C4: Slow network and failure feel (30 min)
**Mission:** Judge perceived performance and resilience when the API is slow (about 3 s) or failing (503, or no response).
**Areas:** first-load spinner, the "Updating results…" refresh indicator while stale rows stay visible, Try again, error copy, footer and status copy that must stay true.
**Heuristics:** Time, Performance-as-perceived. Oracle: the user should always know what is happening.

## Charter C5: Data and robustness exploratory (30 min)
**Mission:** Try to break the catalog with unusual data and navigation.
**Ideas:** whitespace-only search, accented and typographic characters (“ ” — É), boundary years (1449, current year, current year + 1), a hyphenated ISBN, a duplicate ISBN, double-pressing Enter on save, corrupt `localStorage`, unknown routes, browser Back with an unsaved draft, and toggle/delete while a filter is active.
**Heuristics:** Data, Function, "Goldilocks" boundaries, interruptions.

---

Session reports go in `run-log-<date>.md`. Evidence screenshots go in `evidence/`.
