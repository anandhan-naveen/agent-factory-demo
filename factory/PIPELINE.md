# Delivery pipeline: order of agents

Requirements are written by a person (product owner), manually or with their own agent, as GitHub issues.
The pipeline starts by fetching them. Nothing reaches the QA environment until review and the quality gate pass.

| # | Stage | Agent / step | Runs against | Gate to the next stage |
|---|---|---|---|---|
| 0 | Input | **Product owner** writes the user stories (GitHub issues) | – | Issue has acceptance criteria |
| 1 | Intake | **Requirement fetch**: reads the issues, checks the ACs are testable, shares the API contract | GitHub issues | Contract agreed |
| 2 | Build | **Frontend dev** ∥ **Backend dev** (each with unit tests) | local | Unit tests + coverage green |
| 3 | Isolated tests | **Isolated UI automation** (after FE dev) ∥ **API automation** (after BE dev) | localhost: built app with mocked API / local jar | All AC-tagged tests green |
| 4 | Review | **Strict reviewer** (read-only) → **Review fixer** (fresh agent), max 2 rounds | code | Verdict APPROVE (0 blocker, 0 major) |
| 5 | Quality gate | Sonar-class rules, SAST, secrets, dependency and container scans | code | 0 high/critical, 0 lint, 0 secrets |
| 6 | CI/CD → QA | Push: the pipeline re-runs all checks, builds and deploys to QA | GitHub Actions | Pipeline green |
| 7 | QA environment | **Smoke test** (automated go/no-go, minutes) → **Manual QA** (exploratory, against the QA URL) | QA URL | Smoke pass; no open blocker/major defects |
| 8 | Sign-off | **Product owner** accepts the story for UAT / production | QA URL | Human approval |

## Terms

- **CI/CD vs deploy.** CI/CD is the whole automated pipeline (build, test, scan, package, deploy). Deploy is its last step. Writing the pipeline files is one-time setup, not a per-story stage.
- **Smoke vs manual QA.** Smoke: a few automated checks right after a deploy (site up, app loads, health endpoint). It answers "is this build alive?" Manual QA: deeper, exploratory testing of the acceptance criteria and UX on the QA environment. It only starts once smoke passes.
- **Isolated UI automation.** Playwright against a local build with a mocked API, so failures point at the frontend alone.
