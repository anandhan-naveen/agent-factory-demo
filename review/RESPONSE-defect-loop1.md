# Response: defect loop 1 (bugs #38 / D9, #39 / D10)

Review fixer, one pass over `review/REVIEW-defect-loop1.md` (4 review minors + 6 scan findings, R3-FE-04 = S3-02). All fixed, none disputed.

| ID | Status | What changed (files) | Test |
|---|---|---|---|
| S3-01 (major, Semgrep `ts-dom-xss-sink`) | fixed | `frontend/src/components/toastClearance.test.ts`: `document.body.innerHTML = ''` → `document.body.replaceChildren()` | `semgrep --config .semgrep --error frontend tests/ui` → 0 findings (untracked files also scanned with `--no-git-ignore`) |
| R3-FE-01 | fixed | `toastClearance.ts`: new `reserveToastSpace(region)` (measures and sets `--toast-space` + `has-toast`). `Toast.tsx`: `ResizeObserver` on the region (when available) + window `resize` → re-measure `--toast-space` and `keepFocusClearOfToast(region, document.activeElement)`; observer disconnected and listener removed on close/unmount | `Toast.test.tsx` › "re-measures on resize (R3-FE-01)": region grows → `--toast-space` 212px + scroll by 102; window resize → 112px; after close no re-measure and observer disconnected. `toastClearance.test.ts` › `reserveToastSpace` |
| R3-FE-02 | fixed | `toastClearance.ts`: new `releaseToastSpace(space)` drops the space at once unless removing it would clamp the scroll (page scrolled into the reserved space); then it is kept until the user scrolls out of it. Returns a cancel fn (new toast reuses the space) / force-drop (unmount, via a `useEffect` cleanup in `Toast.tsx`) | `toastClearance.test.ts` › release at once / kept until scrolled out / cancel + force. Playwright `tests/ui/specs/toast-focus.spec.ts` › "closing the toast does not make the page jump" (360×780, toggle at page bottom, dismiss → toggle y unchanged). Mutation-checked: with the old immediate release this test fails with a 104 px jump |
| R3-FE-03 | fixed | `loadError.ts`: `describeLoadError(error, filtersActive)`; 400 on page/size → generic copy (the `paging` "loading more" copy is removed); filter/search 400 with no active filters → generic copy, `filtersCause: false`. `CatalogPage.tsx` `renderError` passes `filtersActive` and shows Clear filters iff `filtersCause` | `loadError.test.ts`: page/size → generic for both filter states; "generic copy for a filter-caused 400 when no filters are active". `CatalogPage.test.tsx`: paging 400 → generic copy, no "loading more"; new "unrecognised 400 with no active filters does not ask to clear filters" |
| R3-FE-04 / S3-02 | fixed | `toastClearance.test.ts` and `Toast.test.tsx`: `window.scrollBy` now `vi.spyOn(window, 'scrollBy').mockImplementation(...)` (restored by `restoreMocks`/`vi.restoreAllMocks`), no assignment | Existing tests updated |
| S3-03 | fixed | New shared helper `frontend/src/test/geometry.ts` (`rect()`), used by `Toast.test.tsx` and `toastClearance.test.ts` (outside coverage per vitest config) | n/a |
| S3-04 | fixed | `loadError.ts`: `HTTP_BAD_REQUEST = 400`, `NETWORK_FAILURE_STATUS = 0` | `loadError.test.ts` |
| S3-05 | fixed | `tests/ui/support/toastClearance.ts`: `TOAST_BAND_HEIGHT = 70`, `CLEARANCE_POLL_TIMEOUT_MS = 2_500` | toast-focus specs (mocked + demo) |
| S3-06 | fixed | `tests/ui/specs/toast-focus.spec.ts`: `LONG_CATALOG_SIZE` for generation; `toHaveCount(books.length)` with `books = longCatalog()` | toast-focus specs |

## Gates

- frontend: `npm run lint` (0 warnings) ✓ · `npm run typecheck` ✓ · `npm run test:coverage` 146/146, all files 98.54 % stmts / 96.78 % branches / 98.78 % funcs / 99.04 % lines ✓ · `npm run build` ✓
- tests/ui: `npm run lint` ✓ · `npm run typecheck` ✓ · `npx playwright test` 73/73 passed (chromium + demo) ✓
- `semgrep --config .semgrep --error frontend tests/ui` → 0 findings, exit 0 ✓

Note for the orchestrator: plain `semgrep` limits the scan to git-tracked files, so the untracked files in this diff (e.g. `toastClearance.test.ts`, the S3-01 site) are only covered with `--no-git-ignore` (or after `git add`). Both ways give 0 findings.
