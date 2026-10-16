# Delivery pipeline: order of agents

Requirements are written by a person (product owner), manually or with their own agent, as GitHub issues.
The pipeline starts by fetching them. Nothing reaches the QA environment until the review and the local quality scan are clean. CI/CD then re-runs the same scan on the server (SonarQube quality gate) as the enforcing check: the local scan finds problems early, and the server gate makes sure nothing slips through.

| # | Stage | Agent / step | Runs against | Gate to the next stage |
|---|---|---|---|---|
| 0 | Input | **Product owner** writes the user stories (GitHub issues) | – | Issue has acceptance criteria |
| 1 | Intake | **Requirement fetch**: reads the issues, checks the ACs are testable, shares the API contract | GitHub issues | Contract agreed |
| 2 | Build | **Frontend dev** ∥ **Backend dev** (each with unit tests) | local | Unit tests + coverage green |
| 3 | Isolated tests | **Isolated UI automation** (after FE dev) ∥ **API automation** (after BE dev) | localhost: built app with mocked API / local jar | All AC-tagged tests green |
| 4 | Review + local scan | **Strict reviewer** (read-only) ∥ **Local quality scan** (Sonar rules via SonarQube for IDE / sonar-scanner in connected mode, SAST, secrets, dependency audit) | local workspace | Both reports collected |
| 5 | Fix | **Review fixer** (fresh agent) fixes the combined findings from both reports in one pass; reviewer and scan re-run; max 2 rounds | local workspace | Reviewer APPROVE **and** scan clean (0 high/critical, 0 lint, 0 secrets) |
| 6 | CI/CD → QA | Push: the pipeline re-runs all checks, builds and deploys to QA | GitHub Actions | Pipeline green |
| 7 | QA environment | **Smoke test** (automated go/no-go, minutes) → **Manual QA** (exploratory, against the QA URL) | QA URL | Smoke pass; no open blocker/major defects |
| 8 | Sign-off | **Product owner** accepts the story for UAT / production | QA URL | Human approval |

## Terms

- **CI/CD vs deploy.** CI/CD is the whole automated pipeline (build, test, scan, package, deploy). Deploy is its last step. Writing the pipeline files is one-time setup, not a per-story stage.
- **Smoke vs manual QA.** Smoke: a few automated checks right after a deploy (site up, app loads, health endpoint). It answers "is this build alive?" Manual QA: deeper, exploratory testing of the acceptance criteria and UX on the QA environment. It only starts once smoke passes.
- **Isolated UI automation.** Playwright against a local build with a mocked API, so failures point at the frontend alone.
