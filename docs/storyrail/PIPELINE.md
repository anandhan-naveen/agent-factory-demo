# StoryRail pipeline: order of agents and gates

Requirements are written by a person (product owner), manually or with their own agent, as GitHub issues.
The pipeline starts by fetching them. Nothing reaches the QA environment until the review and the local quality scan are clean. CI/CD then re-runs the same scan on the server (SonarQube quality gate) as the enforcing check: the local scan finds problems early, and the server gate makes sure nothing slips through.

| # | Stage | Agent / step | Runs against | Gate to the next stage |
|---|---|---|---|---|
| 0 | Input | **Product owner** writes the user stories (GitHub issues) | – | Issue has acceptance criteria |
| 1 | Intake | **Requirement fetch** (`sr-req-fetch`): reads the issues, checks the ACs are testable, shares the API contract | GitHub issues | Contract agreed |
| 2 | Build | **Frontend dev** (`sr-fe-dev`) ∥ **Backend dev** (`sr-be-dev`), each with unit tests; only the lanes the story needs | local | Unit tests + coverage green |
| 3 | Isolated tests | **Isolated UI automation** (`sr-ui-tests`, after FE dev) ∥ **API automation** (`sr-api-tests`, after BE dev) | localhost: built app with mocked API / local jar | All AC-tagged tests green |
| 4 | Review + local scan | **Strict reviewer** (`sr-reviewer`, read-only) ∥ **Local quality scan** (`sr-scan`) (Sonar rules via SonarQube for IDE / sonar-scanner in connected mode, SAST, secrets, dependency audit) | local workspace | Both reports collected |
| 5 | Fix | **Review fixer** (`sr-fixer`, fresh agent) fixes the combined findings from both reports in one pass; reviewer and scan re-run; max 2 rounds | local workspace | **Quality gate:** reviewer APPROVE (0 blocker/major) **and** scan with 0 blocker/major, 0 lint warnings, 0 secrets, 0 high/critical vulnerabilities. Minors are fixed but never block. |
| 6 | CI/CD → QA | PR: the pipeline re-runs all checks. **You approve the merge**, which deploys to QA | GitHub Actions | PR checks green + your OK |
| 7 | QA environment | **Smoke test** (automated go/no-go, minutes) → **Manual QA** (`sr-manual-qa`, exploratory, against the QA URL) | QA URL | Smoke pass; no open blocker/major defects |
| 8 | Sign-off | **Product owner** accepts the story for UAT / production | QA URL | Human approval |

## Terms

- **CI/CD vs deploy.** CI/CD is the whole automated pipeline (build, test, scan, package, deploy). Deploy is its last step. Writing the pipeline files is one-time setup, not a per-story stage.
- **Smoke vs manual QA.** Smoke: a few automated checks right after a deploy (site up, app loads, health endpoint). It answers "is this build alive?" Manual QA: deeper, exploratory testing of the acceptance criteria and UX on the QA environment. It only starts once smoke passes.
- **Isolated UI automation.** Playwright against a local build with a mocked API, so failures point at the frontend alone.
- **Human gates.** You write the story, you answer open questions, you approve the merge to QA, you triage QA defects, and you sign off. Everything between is the agents' job.

## Defect loop (`/storyrail fix <bug issues>`)

For bugs found in QA. Shorter than the story rail: only the affected lane runs.

1. Bug ticket is the requirement (no requirement fetch).
2. Dev of the affected lane fixes it.
3. That lane's test agent adds a **regression test that fails on the old code**.
4. Review + local scan on the **diff only**; fixer if needed (max 2 rounds).
5. PR (`Fixes #bug`) → checks → your OK → deploy to QA → smoke.
6. Manual QA re-tests the defect and the area around it.

Severity decides what blocks sign-off: blocker/major are fixed first; minor/low can go to the backlog. A defect that shows
the requirement itself was wrong is a requirement change and goes back through the full rail.

## Where things are

| What | Where |
|---|---|
| Orchestrator (`/storyrail`) | `.claude/skills/storyrail/SKILL.md` |
| Agents | `.claude/agents/sr-*.md` |
| Project conventions every agent follows | `CLAUDE.md` |
| Output of one run | `runs/issue-<N>/` |
| Live dashboard | `node scripts/storyrail-dashboard.mjs` → http://localhost:4800 |
| Setup on a new machine | [SETUP.md](SETUP.md) |

