# Defect loop 1 (bugs #38, #39): review + local scan

Strict reviewer: **APPROVE** (0 blocker, 0 major, 4 minor). Local quality scan: 1 major (blocking Semgrep rule), 5 minor (one duplicates R3-FE-04).
The review fixer resolves all of them in one pass.

| ID | Sev | Source | File | Problem | Fix |
|---|---|---|---|---|---|
| S3-01 | major | scan (Semgrep `ts-dom-xss-sink`, blocking) | frontend/src/components/toastClearance.test.ts:32 | `document.body.innerHTML = ''` | `document.body.replaceChildren()` |
| R3-FE-01 | minor | review | frontend/src/components/Toast.tsx:42 | Reserved toast space measured once; no re-measure on resize/orientation change, so focus can end up under the toast (WCAG 2.4.11 gap) | ResizeObserver on the region + window `resize` → recompute `--toast-space` and `keepFocusClearOfToast(region, document.activeElement)`; clean both up; unit test |
| R3-FE-02 | minor | review | frontend/src/components/Toast.tsx:54 | Removing the reserved padding on close makes the page jump ~90 px when scrolled to the bottom | Keep the space through a short exit, or compensate the scroll only when it would be clamped |
| R3-FE-03 | minor | review | frontend/src/components/loadError.ts:26 + CatalogPage `renderError` | page/size 400 copy talks about "loading more" but the panel only shows page-0 failures; unrecognised 400 says "clear the filters" when no filters are active (button hidden) | Generic copy for page/size; generic copy when `filtersCause && !filtersActive`; tests for both |
| R3-FE-04 / S3-02 | minor | review + scan | frontend/src/components/toastClearance.test.ts:49 | `window.scrollBy` replaced by assignment, never restored | `vi.spyOn(window, 'scrollBy').mockImplementation(() => {})` |
| S3-03 | minor | scan | Toast.test.tsx:69-70, toastClearance.test.ts:6-8 | Duplicated `rect()` helper | Share one test helper |
| S3-04 | minor | scan | frontend/src/components/loadError.ts:24,29 | Magic numbers 400 / 0 | Named constants |
| S3-05 | minor | scan | tests/ui/support/toastClearance.ts:45,105 | Magic numbers 70 / 2_500 | Named constants |
| S3-06 | minor | scan | tests/ui/specs/toast-focus.spec.ts:8,33 | Repeated `24` | `longCatalog().length` |
