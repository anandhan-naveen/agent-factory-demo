# Strict review, round 1

Reviewers: two read-only reviewer agents (no edit tools), FE half and BE half in parallel.
**Verdict: CHANGES_REQUESTED.** 3 blocker · 7 major · 12 minor (22 findings).

Orchestrator decision for R-CI-01: the issue's "Spring Boot 3.3" pin is relaxed to **the latest patched Spring Boot 3.x release** (3.3 is out of OSS support and carries critical Tomcat CVEs).

## Frontend + UI tests

| ID | Sev | File | Problem | Fix |
|---|---|---|---|---|
| R-FE-01 | major | frontend/src/hooks/useBooks.ts:18 | Always requests page 0 size 100, ignores totalItems/totalPages; >100 books silently truncated and heading count wrong (FE-AC1). | Track totalItems/totalPages; add "Load more" fetching page+1; heading uses totalItems; unit test + mocked UI test seeding 101 books. |
| R-FE-02 | major | tests/ui/support/env.ts:4 + playwright.config.ts:45 + frontend.yml:106 | Demo-mode build (what Pages deploys) has no E2E coverage. | Add a `demo` Playwright project/webServer (empty VITE_API_BASE_URL, separate port/outDir) with a smoke subset (AC1–4, 7–9, demo badge, persistence after reload; clear localStorage in fixture); run `--project=demo` in CI too. |
| R-FE-03 | major | frontend/src/components/BookRow.tsx:83,95 | `disabled={busy}` on focused toggle/delete drops focus to body (QA D1, WCAG 2.4.3). | Use `aria-disabled` + early return while busy; RTL test asserts focus kept. |
| R-FE-04 | major | frontend/src/components/EmptyState.tsx:10, CatalogPage.tsx:126 | Result count / empty state not announced (QA D2 = UI F-01, FE-AC10, WCAG 4.1.3). | One always-mounted visually-hidden `role="status" aria-live="polite"` with "{n} books found"/"No books match your filters" when not loading; remove `test.fail` at tests/ui/specs/accessibility.spec.ts:74; close F-01. |
| R-FE-05 | major | CatalogPage.tsx:32,67; AddBookPage.tsx:24 | Focus lost after Clear filters, Try again, and after save (QA D3). | Focus search input on clear; focus results heading on retry; navigate with state `{focus:'results'}` and focus heading on mount; RTL focus assertions. |
| R-FE-06 | minor | CatalogPage.tsx:40 / useBooks.ts:30 | In-flight list response can overwrite a just-applied toggle. | mutationSeq ref; if changed when list resolves, reload instead of applying stale page; unit test with deferred promise. |
| R-FE-07 | minor | useBooks.ts:33 | Abort / stale-response path untested (60% branches). | Test: query A deferred, switch to B, resolve B then A; only B renders; A aborted. |
| R-FE-08 | minor | CatalogPage.tsx:40 | With "Available only" on, a book toggled to on-loan stays listed (UI O-01, FE-AC3). | If availableOnly && !updated.available → removeBook + focus heading; unit + UI test. |
| R-FE-09 | minor | Toast.tsx:25 | Errors show success icon in polite status; close "×" is inside live region. | `kind: 'success'|'error'`; error styling + `role="alert"`; move dismiss button outside live region. |
| R-FE-10 | minor | App.tsx:63 | Footer claims "Connected to the catalog service." even during errors (QA D5). | Neutral copy: "Live catalog: changes are saved to the catalog service." |
| R-FE-11 | minor | styles.css:565 | Badge column misaligned across rows; delete confirm shifts badge (QA D7). | Fixed grid tracks (e.g. `minmax(0,1fr) 7.5rem 17rem`) or subgrid; keep mobile overrides. |
| R-FE-12 | minor | BookForm.tsx:185 | `maxLength={4}` truncates pasted " 1999 " and hides range errors. | Remove maxLength (or trim on change). |
| R-FE-13 | minor | demoApi.ts:138 | Negative page reported under `size`. | Separate `page` error: "Page must be 0 or greater". |

QA defects D4 (no dark mode) and D8 (20px checkbox target) were not confirmed as AC violations; the fixer may address D8 cheaply (24px target, WCAG 2.2 AA 2.5.8).

## Backend + API tests + CI

| ID | Sev | File | Problem | Fix |
|---|---|---|---|---|
| R-BE-01 | blocker | BookService.java:57, ClockConfig.java:12, DataSeeder.java:34 | createdAt has nanoseconds in POST response but microseconds after DB reload → POST vs GET mismatch; ~12 API tests fail. | Truncate to MICROS (or MILLIS) at creation in service and seeder (or tick clock); @SpringBootTest asserting POST.createdAt == GET.createdAt. |
| R-BE-02 | blocker | JacksonConfig.java:15-17, application.yml:12-14 | Scalar coercion on: `{"available":2}` → true (200); "1999" and 1999.7 accepted. availability.spec.ts:29 expects 400 (contract agrees). | Disable MapperFeature.ALLOW_COERCION_OF_SCALARS and DeserializationFeature.ACCEPT_FLOAT_AS_INT; single source of strictness config; WebMvcTests for those inputs → 400 with errors.<field>. |
| R-CI-01 | blocker | backend/pom.xml:10 (Trivy gate backend.yml:192-200) | Boot 3.3.5 → tomcat-embed-core 10.1.31 with CRITICAL CVEs (CVE-2024-50379, CVE-2025-24813); Trivy fails docker job on main; dependency-review likely too. | Upgrade to the latest patched Spring Boot 3.x (see decision above); override any remaining flagged managed versions. |
| R-BE-03 | major | BookController.java:47-49 | page*size > Integer.MAX_VALUE → 500. | Validate `(long) page * size > Integer.MAX_VALUE` → 400 errors.page; WebMvcTest + API test. |
| R-CI-02 | major | backend.yml:179-200, render.yaml:7-8 | Image pushed (incl. latest) before Trivy scan; Render builds from Dockerfile, not the scanned image. | Build with load:true push:false → Trivy on local tag → then push (cache hit). Document/align Render deploy with the scanned image. |
| R-BE-04 | minor | Book.java:15-17, BookService.java:61-75 | Concurrent PUT + PATCH: PUT flush overwrites `available` (BE-AC7). | `@DynamicUpdate` (or @Version → 409). |
| R-BE-05 | minor | ApiExceptionHandler.java:75-78, BookInput.java:15 | `isbn: ""` gives non-deterministic message (NotBlank vs Isbn13). | Isbn13Validator returns true for blank; test exact errors.isbn for "". |
| R-BE-06 | minor | tests/api/support/contract.ts:19-33, README.md:40-42 | Contract-parse fallback is dead code that would hide a broken contract; README note is stale. | Remove fallback + README paragraph; throw on parse error. |
| R-BE-07 | minor | tests/api/support/data.ts:36 | CURRENT_YEAR uses local TZ; backend uses UTC. | `getUTCFullYear()`. |
