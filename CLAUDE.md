# StoryRail project guide

StoryRail takes a user story (a GitHub issue written by the product owner) through a squad of agents to a
signed-off release. Start a run with `/storyrail <issue-number>`. The stage order and gates are in
[docs/storyrail/PIPELINE.md](docs/storyrail/PIPELINE.md); the agents are in `.claude/agents/sr-*.md`.

The app it currently builds is a **Library Catalog** (books: browse, search, filter, add, delete, loan toggle).

## Repository map

| Path | What | Owner agent |
|---|---|---|
| `frontend/` | React 18 + TypeScript (strict), Vite, React Router (HashRouter), Vitest + RTL | sr-fe-dev |
| `backend/` | Java 21, Spring Boot 3.5, Maven, Spring Data JPA, H2, Bean Validation, ProblemDetail errors | sr-be-dev |
| `docs/api/openapi.yaml` | API contract, **single source of truth** for FE, BE and API tests | sr-req-fetch proposes, devs implement |
| `tests/ui/` | Playwright UI automation: `chromium` project (mocked API via `page.route`) + `demo` project (demo build) | sr-ui-tests |
| `tests/api/` | Playwright API tests against a running backend (`API_BASE_URL`) | sr-api-tests |
| `tests/manual/` | Manual QA charters, cases, run logs, evidence | sr-manual-qa |
| `runs/issue-<N>/` | Everything one run produces: spec, review and scan reports, fixer responses, QA log | all |
| `.github/workflows/` | CI/CD: `frontend.yml`, `backend.yml`, `security.yml` (CI only — agents don't edit these unless the story is about CI) | — |
| `docs/history/run-1/` | Archive of the first, hand-orchestrated run (old briefs and reviews) — read-only reference | — |

## Commands (all must pass before a stage is done)

```bash
# frontend
(cd frontend && npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm audit --audit-level=high)
# backend (needs Java 21 + Maven 3.9)
(cd backend && mvn -B verify)          # unit tests, JaCoCo ≥ 80 %, SpotBugs, PMD, Checkstyle (warnings)
(cd backend && mvn spring-boot:run)    # http://localhost:8080, H2 seeded
# UI automation (builds the app itself; needs frontend deps installed)
(cd tests/ui && npm ci && npm run lint && npm run typecheck && npx playwright test)
# API automation (backend must be running on :8080)
(cd tests/api && npm ci && npm run lint && npm run typecheck && API_BASE_URL=http://localhost:8080 npx playwright test)
```

First time on a machine: `(cd tests/ui && npx playwright install chromium)`.

## Conventions every agent follows

- **Stay in your lane.** Each agent writes only to the paths its brief allows. Report problems outside your lane instead of fixing them.
- **Contract first.** API changes go into `docs/api/openapi.yaml` before code. Field names, status codes and problem titles must match it exactly.
- **Errors** are RFC 7807 `application/problem+json`; 400s carry `errors: { field: message }`. Never leak stack traces or class names.
- **Frontend:** no `any`, no `dangerouslySetInnerHTML`, no browser dialogs (`alert/confirm/prompt`). Accessible names and roles first; `data-testid` as the fallback hook for tests. Keyboard focus must never land on `<body>` after an action. Respect `prefers-reduced-motion`.
- **Backend:** Java records for DTOs, constructor injection only, no Lombok. Inject `java.time.Clock` for anything time-based. Tests: JUnit 5, Mockito, `@WebMvcTest`, `@DataJpaTest`.
- **Tests are tagged with the acceptance criterion they prove**, e.g. `@AC3` in the title, so every AC is traceable.
- **Every bug fix gets a regression test** that fails on the old code.
- **Lint is zero-warning** (ESLint + `eslint-plugin-sonarjs`), TypeScript strict, `npm audit` high = 0.
- **No secrets** in code, tests or logs.

## Reporting progress (every agent)

Report to the live dashboard with the status script (never edit `.storyrail/` by hand):

```bash
node scripts/storyrail-status.mjs set <station> running 30 "short note (≤ 60 chars)"
node scripts/storyrail-status.mjs log <station> ok "one-line result"
node scripts/storyrail-status.mjs set <station> done 100 "headline result, e.g. 24 tests · 96% cov"
```

**Run every command from the repo root.** The Bash working directory persists between calls, so use subshells for other folders, e.g. `(cd frontend && npm run lint)`, never a bare `cd`.

Use your own station id only (given in your agent file). Report at 3–5 milestones, not on every step.
Statuses: `pending running done failed skipped waiting`. Log levels: `ok warn bad info`.
