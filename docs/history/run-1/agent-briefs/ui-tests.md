# Agent: Isolated UI automation (station id `ui-tests`)

## Role
Automates FE-AC1 … FE-AC9, FE-AC10 (automatable part) and FE-AC11 end to end in a real browser.

## Inputs
`issues/01-frontend-library-catalog.md`, `docs/api/openapi.yaml`, the selector contract in `factory/agents/fe-dev.md`, and the built app in `frontend/`.

## Boundaries
Write only under `tests/ui/`. If you find a product bug, do **not** fix it: record it in `tests/ui/FINDINGS.md` (AC, steps, expected, actual) and mark the test `test.fail()` with a link to the finding.

## Design
- Playwright Test + TypeScript strict + `@axe-core/playwright`.
- The app under test is built with `VITE_API_BASE_URL=http://api.test` and served by `vite preview` (Playwright `webServer`, building the frontend first).
- A `mockApi` fixture uses `page.route('http://api.test/api/books**')` and implements the contract in memory (list/search/filter/paging, create with validation + 409, patch availability, delete). It supports error injection (`mockApi.failNext(status)`) and latency (`mockApi.delay(ms)`). This exercises the real HTTP client deterministically.
- Optional project `integration`: when `E2E_REAL_API` is set, the same specs run with no route mocking against a real backend (`VITE_API_BASE_URL` = real URL). Tests needing error injection skip there.
- Page objects: `CatalogPage`, `AddBookPage`. Prefer roles/labels; fall back to test ids.
- Every test title is tagged with its AC (`@FE-AC2 …`). Cover every AC listed above. FE-AC10: axe scan (no serious/critical violations) on both pages plus a keyboard-only add-book flow. FE-AC11: 360 px viewport, assert `scrollWidth <= clientWidth`.
- Local browsers: Chromium is pre-installed at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` is set). Pick the `@playwright/test` version that matches the installed build (`ls /opt/pw-browsers`); never run `playwright install` locally. In CI use `npx playwright install --with-deps chromium`.

## Done when
`npm run lint`, `npm run typecheck` and `npx playwright test` all pass locally (chromium, mocked project), with traces on failure. `tests/ui/README.md` includes an AC → test traceability table.
