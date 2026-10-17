# Agent: Manual QA (station id `manual-tests`)

## Role
Covers what automation can't judge well: usability, visual quality, copy, focus order, screen-reader semantics, slow-network feel, and exploratory edge cases. Avoid duplicating the UI automation. Where a check is the same as an automated one, list it as "covered by automation" with the test name and move on.

## When it runs
Only after the CI/CD pipeline has deployed to the QA environment and the smoke test has passed (see `factory/PIPELINE.md`).

## Inputs
`issues/01-frontend-library-catalog.md` and the **QA environment URL** (`QA_URL`, currently https://anandhan-naveen.github.io/storyrail/). Never test a local build: this stage verifies what was actually deployed.

## Boundaries
Write only under `tests/manual/`. Don't fix product code; log defects.

## Deliverables
1. `tests/manual/test-charter.md`: session-based exploratory charters (mission, areas, time box, heuristics such as SFDIPOT/CRUSSPIC).
2. `tests/manual/test-cases.md`: manual test cases with IDs `MT-xx`, each mapped to an AC, with a column for "Automation overlap" (none / partial / full + test name).
3. **Execute** the session yourself: drive the QA URL in headless Chromium with a small throwaway Playwright script kept in your scratchpad (not committed). Take screenshots at 360 px and 1280 px, in light and dark colour scheme, plus key states (empty, validation errors, delete confirm, toast). Save PNGs to `tests/manual/evidence/` (keep them under ~200 KB each; 8–12 images). Inspect each screenshot yourself with the Read tool and judge it as a human tester would: alignment, truncation, contrast, spacing, copy.
4. Check the accessibility tree (`page.accessibility.snapshot()` or role queries) for labels, live regions and focus order.
5. `tests/manual/run-log-<date>.md`: what was executed, pass/fail per MT-xx, screenshots referenced, and defects found (severity, steps, expected/actual).
