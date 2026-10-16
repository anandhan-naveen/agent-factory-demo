# Manual QA re-test log: 2026-10-17 (QA environment, D9 and D10)

**Tester:** Manual QA agent (station `manual-tests`)
**Target:** https://anandhan-naveen.github.io/agent-factory-demo/ in demo mode, after the deploy of `ce64130` ("fix(frontend): QA defects #38 and #39 (#42)") and a passing smoke test.
**New build confirmed:** the page loads `assets/index-Ctmk463V.js` and `assets/index-D9CCzHyc.css`. The earlier run used `index-DqIRSBPt.js`. The new copy ("Your search is too long…") and the `html.has-toast` / `--toast-space` behaviour are both present. Every browser context was new and had its storage cleared, which works like a hard reload.
**Browser:** headless Chromium 141 (Playwright 1.56.1, `/opt/pw-browsers`), DPR 1. Throwaway driver scripts were kept in the scratchpad and not committed. I inspected every screenshot by eye.
**Scope:** a targeted re-test of D9 (#38) and D10 (#39), plus regression around the change. The full 22-case suite was not re-run.
**Environment note:** the only console errors were two `ERR_TUNNEL_CONNECTION_FAILED` entries per page, both for `fonts.googleapis.com`. The test sandbox's egress proxy blocks that host, so these are not app errors. Fonts fell back to system fonts and the layout was not affected.

## 1. D9 / #38: toast hides the focused control (Medium)

Geometry was measured at 0, 150, 600 and 1500 ms after Enter: the toast, the focused toggle and the row's badge, all in viewport px.

| # | Check | Result | Measurements |
|---|---|---|---|
| 1.1 | **Original steps, 360×780 (dark):** "Mark on loan" placed 40 px above the bottom, focused, Enter | **Pass** | At t=0 the toast (688–756) briefly overlaps the toggle (698–738) while the smooth scroll runs. By 150 ms the page has scrolled 83 px: toggle 615–655, badge "On loan" 577–605, a 33 px gap above the toast. This holds for the full 4 s. Focus stays on the toggle. `--toast-space: 104px`. (01) |
| 1.2 | Harder variant at 360×780: toggle 10 px from the bottom edge | **Pass** | The badge and toggle are both under the toast at t=0. Both are clear by 150 ms (scroll 295 → 391). |
| 1.3 | 1280×800, toggle 40 px above the bottom | **Pass** | At t=0 the toast (450–830 × 732–782) overlaps the badge column. By 150 ms the row has scrolled up 79 px: badge 640–667, toggle 633–673, toast 726–776. (02) |
| 1.4 | Landscape 780×360: toggle near the bottom, Enter | **Pass** | Clear by 150 ms. Toggle at 213–253, toast at 286–336. |
| 1.5 | **Rotate while the toast is visible:** 780×360 → 360×780 → 780×360 | **Pass** | The space is re-measured on resize (86 px → 104 px → 86 px). The focused toggle and badge stay clear and in the viewport after each rotation. |
| 1.6 | **Rotate while the toast is visible:** 360×780 (The Gene) → 780×360 | **Pass** | After rotation the toggle is at 213–253, the badge at 148–175 and the toast at 286–336. (03) |
| 1.7 | **Scrolled to the very bottom, toast times out** (360×780) | **Pass, no jump** | scrollY stays at 1790 and the focused toggle's top stays at 473 through the timeout. The reserved space is kept until the user scrolls up, then released (max scroll 1790 → 1686, `has-toast` removed). |
| 1.8 | **Scrolled to the very bottom, toast dismissed** (mouse click on ×, and keyboard Enter on ×) | **Pass, no jump** | scrollY does not change (1790 for the mouse click, 1686 for the keyboard). The space is released when the user scrolls up. See D11 for where focus goes. |
| 1.9 | Reduced motion | Pass | `prefers-reduced-motion: reduce` uses `behavior: 'auto'`, so there is no animated scroll. The result is the same. |
| 1.10 | No horizontal scroll while the toast is shown (360) | Pass | `scrollWidth == clientWidth == 360` in every sample. |

The only overlap was a transient one, under 150 ms at t=0, which is the time the app's smooth scroll takes to start. The focused control was never left hidden, and the toast never took focus.

**D9 verdict: Verified fixed.**

## 2. D10 / #39: load error shows "Validation failed" (Low)

The bug was forced the same way as before: `maxlength` was removed from Search through the DOM and 201 characters were filled in.

| # | Check | Result | Notes |
|---|---|---|---|
| 2.1 | Copy at 360 and 1280 | **Pass** | "We couldn't load the catalog. / Your search is too long. Shorten it and try again." The panel is `role=alert`. "Validation failed" no longer appears. The heading reads "Books" and the footer reads "Demo mode · changes are saved in this browser only." (04, 05) |
| 2.2 | Buttons | **Pass** | "Try again" (primary) and "Clear filters" (secondary) sit side by side and centred. At 360 they fit on one row, with no horizontal scroll. |
| 2.3 | Try again (search still too long) | Pass | The error is shown again and focus moves to the "Books" h2. This is as before (D3). |
| 2.4 | Clear filters (keyboard Enter) | **Pass** | Focus moves to Search with `:focus-visible`. The value is empty, 8 rows come back, the heading reads "8 books" and the live region reads "8 books found". |
| 2.5 | Genre filter plus a long search, then Clear filters | Pass | Both the genre and the search are reset, 8 rows come back and focus is on Search. |

**D10 verdict: Verified fixed.** The non-search 400 copy, the network copy and the generic copy cannot be triggered on the demo build. The unit and Playwright tests in #42 cover them.

## 3. Regression around the change

| # | Check | Result | Notes |
|---|---|---|---|
| 3.1 | Toast after Add book (1280) | Pass | Save returns to `#/`. Focus is on the "9 books" h2 with a visible ring. The "Book added" toast is visible, and the new row "Retest Book" is listed. The toast is centred at the bottom and doesn't cover the focused heading. (06) |
| 3.2 | Toggle with "Available only" on | Pass | 7 → 6 rows. Focus moves to the "6 books" heading, the status reads "6 books found" and the toast reads "“A Brief History of Time” marked on loan". |
| 3.3 | Delete flow (keyboard) | Pass | The confirm opens with focus on Cancel. Escape returns focus to "Delete Sapiens…". A confirmed delete puts focus on the "8 books" heading, shows the "…deleted" toast and sets the status to "8 books found". |
| 3.4 | Error panel Try again | Pass | See 2.3. |
| 3.5 | Keyboard-only pass of the catalog (360) | Pass | Tab order: skip link, brand, Add book, Search, Genre, Available only, then for each row the toggle and Delete. Every stop has `:focus-visible` and a 3 px solid outline. |
| 3.6 | Screen-reader live regions | Pass (unchanged) | `results-status` is `<p role=status aria-live=polite>` (visually hidden). The toast message is a separate `<span role=status aria-live=polite>` holding only the text. The error panel is `role=alert`. |
| 3.7 | No horizontal scroll at 360 | Pass | `scrollWidth 360 = clientWidth 360` on the catalog, with a toast, and on the error panel. |

## Defect status

| ID | GitHub | Severity | Verdict |
|---|---|---|---|
| D9 | #38 | Medium | **Verified fixed** |
| D10 | #39 | Low | **Verified fixed** |

### New defect

| ID | Severity | AC | Summary |
|---|---|---|---|
| D11 | Low | FE-AC10 (focus management) | Dismissing the toast with its × button sends focus to `<body>` |

**D11 steps:** 1. At 360×780, toggle any book with Enter. 2. Press Tab twice to reach "Dismiss notification" (it comes after the row's Delete), or click it. 3. Press Enter.
**Expected:** Focus returns to a sensible place, such as the control that was focused before the toast (the toggle).
**Actual:** `document.activeElement` is `<body>`, so the next Tab starts again from the top of the page. The page does not jump. This is not caused by the D9/D10 change, because the dismiss button behaved the same before. It was simply not exercised in the earlier run. It is not logged as a GitHub issue from this re-test and is left for triage.

### Observations
- Only the focused row is kept clear of the toast. A row that is not focused can still sit partly under it, for example Sapiens' badge after Add book (06). The changed item and the focus are always visible, so this is acceptable.
- The toast reaches the bottom of the viewport within about 150 ms, so there is a brief overlap at t=0 before the smooth scroll finishes. It is not noticeable when testing by hand.

## Evidence (`tests/manual/evidence/retest-2026-10-17/`)
| File | What it shows |
|---|---|
| 01-d9-toast-clear-of-focus-360.png | D9 steps at 360×780: the toggle (focus ring) and the "On loan" badge sit above the toast |
| 02-d9-toast-clear-1280.png | 1280×800: the Guns of August row has scrolled clear of the centred toast |
| 03-d9-after-rotate-780x360.png | After rotating 360×780 → 780×360 with the toast visible, focus and badge are still clear |
| 04-d10-error-copy-360.png | D10 at 360: the new copy with Try again and Clear filters |
| 05-d10-error-copy-1280.png | D10 at 1280: the new copy and a truthful footer |
| 06-add-book-toast-1280.png | Regression: after Add book, focus is on "9 books" and the "Book added" toast is visible |
