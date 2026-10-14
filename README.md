# Agent factory demo: Library Catalog

A small full-stack app built end to end by an **agent factory**: one orchestrator and a set of specialised Claude
agents (frontend dev, backend dev, UI tests, API tests, manual QA, CI/CD), each working from a written brief and
reporting to a live dashboard. The product is a library catalog: browse, search, filter, add, delete and toggle the
availability of books.

| Part | Stack | Docs |
|---|---|---|
| `frontend/` | React 18, TypeScript, Vite, Vitest | [frontend/README.md](frontend/README.md) |
| `backend/` | Spring Boot 3.3, Java 21, H2, JaCoCo, SpotBugs | [backend/README.md](backend/README.md) |
| `docs/api/openapi.yaml` | Books API contract (single source of truth) | |
| `tests/ui/` | Playwright UI tests (mocked API or real backend) | [tests/ui/README.md](tests/ui/README.md) |
| `tests/api/` | Playwright API contract tests | [tests/api/README.md](tests/api/README.md) |
| `tests/manual/` | Charters, manual test cases, run log | [tests/manual/](tests/manual/) |

- **Issues (user stories + acceptance criteria):** [01 frontend](issues/01-frontend-library-catalog.md) ·
  [02 backend](issues/02-backend-books-api.md)
- **Factory agent briefs:** [factory/agents/](factory/agents/) (e.g. [fe-dev](factory/agents/fe-dev.md),
  [be-dev](factory/agents/be-dev.md), [ui-tests](factory/agents/ui-tests.md), [api-tests](factory/agents/api-tests.md),
  [manual-tests](factory/agents/manual-tests.md), [cicd](factory/agents/cicd.md))
- **Test traceability (AC → tests):** [UI](tests/ui/README.md#ac--test-traceability) ·
  [API](tests/api/README.md#traceability) · [manual](tests/manual/test-cases.md)
- **Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Pipelines

```mermaid
flowchart LR
  subgraph FE["frontend.yml (frontend/**, tests/ui/**)"]
    q[quality<br/>lint · typecheck · coverage · build · audit] --> dp[deploy-pages<br/>main only]
    e2e[e2e<br/>Playwright, mocked API] --> dp
  end
  subgraph BE["backend.yml (backend/**, tests/api/**, docs/api/**)"]
    b[build<br/>mvn verify: tests · JaCoCo · SpotBugs] --> at[api-tests<br/>jar + Playwright API]
    at --> d[docker<br/>GHCR push + Trivy<br/>main only]
    d --> r[deploy-render<br/>hook · health · smoke]
  end
  subgraph SEC["security.yml (every push/PR + weekly)"]
    c[CodeQL JS/TS + Java]
    dr[dependency-review<br/>PRs]
    g[gitleaks]
    s[sonarcloud<br/>if SONAR_TOKEN]
  end
  dp --> pages[(GitHub Pages)]
  d --> ghcr[(GHCR)]
  r --> render[(Render)]
```

Dependabot (`.github/dependabot.yml`) opens weekly grouped minor/patch updates for npm, Maven, Docker and Actions.

## Run locally

Requirements: Node 22, Java 21, Maven 3.9+.

**Frontend** (demo mode, no backend needed):

```bash
cd frontend
npm ci
npm run dev                                   # http://localhost:5173/#/
npm run lint && npm run typecheck && npm run test:coverage && npm run build
```

**Backend:**

```bash
cd backend
mvn verify                                    # unit tests, JaCoCo 80 % gate, SpotBugs
mvn spring-boot:run                           # http://localhost:8080 (H2, seeded with 8 books)
```

**Frontend against the backend:**

```bash
cd frontend && VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

**UI tests** (builds the app into `tests/ui/.app-dist`, so install `frontend/` deps first):

```bash
(cd frontend && npm ci)
cd tests/ui
npm ci
npx playwright install --with-deps chromium
npx playwright test                           # mocked API
E2E_REAL_API=http://localhost:8080 npx playwright test   # against a running backend
```

**API tests** (backend running on :8080):

```bash
cd tests/api
npm ci
API_BASE_URL=http://localhost:8080 npx playwright test
```
