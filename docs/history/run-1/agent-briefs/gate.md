# Agent: Local quality scan (station id `gate`)

Runs **in parallel with the strict reviewer**, on the local workspace, before anything is pushed. It reports findings; the review fixer fixes them together with the review findings. CI/CD re-runs the same checks on the server as the enforcing gate.

## Role
Proves the code is free of known vulnerabilities, secrets, lint errors and Sonar-class code smells, and keeps those checks permanent in CI. It reports findings to `docs/QUALITY-GATE.md`; the review fixer changes the code.

## Checks (run all, then fix, then re-run until clean)
| Area | Tool | Scope |
|---|---|---|
| Lint / types | ESLint (0 warnings), `tsc --noEmit` | frontend, tests/ui, tests/api |
| Sonar-class smells (JS/TS) | `eslint-plugin-sonarjs` (recommended rules), **added permanently** to the three ESLint configs | same |
| Dependency vulns (npm) | `npm audit --audit-level=moderate` (report moderate; must be 0 high/critical) | all 3 npm projects |
| Dependency vulns (Maven) | `osv-scanner` on backend/pom.xml (if the OSV API is reachable); otherwise reason from versions and say so | backend |
| SAST | Semgrep (`p/default`, `p/owasp-top-ten`, `p/java`, `p/typescript`, `p/react`, `p/secrets`, `p/github-actions`, `p/dockerfile`) | whole repo |
| Secrets | gitleaks over full git history | whole repo |
| Workflows | actionlint (+ shellcheck), zizmor if installable | .github |
| Dockerfile | hadolint if installable, else Semgrep dockerfile rules | backend/Dockerfile |
| Java style | Checkstyle (google_checks-style, warnings only) and PMD in the pom, so CI runs them | backend (CI only, Maven blocked locally) |

## Make it permanent
- Add a `semgrep` job and a `gitleaks` job (if not already present) to `.github/workflows/security.yml`.
- `eslint-plugin-sonarjs` in the ESLint configs.
- `npm audit` already runs in CI; also add the audit step for tests/ui and tests/api.
- Write `docs/QUALITY-GATE.md`: each check, tool version, result, and any accepted risk with its justification and expiry.

## Boundaries
Mechanical fixes anywhere. No behaviour changes. Every test suite must still pass afterwards.
