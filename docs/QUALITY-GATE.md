# Quality gate

Last run: 2026-10-14 (station `gate`). Each row says where the check runs permanently.

## Results

| Check | Tool (version) | Scope | Before | After | Runs in CI |
|---|---|---|---|---|---|
| Lint, 0 warnings | ESLint 9.39.5 + typescript-eslint 8.71.2 | frontend, tests/ui, tests/api | 0 | 0 | frontend.yml, backend.yml |
| Sonar-class smells | eslint-plugin-sonarjs 4.2.2 (`recommended`) | same | 28 (23 FE, 4 UI, 1 API) | 0 | same (part of `npm run lint`) |
| Types | `tsc --noEmit` (TypeScript 5.9.3) | same | 0 | 0 | same |
| npm vulnerabilities | `npm audit` (npm 10.9.4) | frontend | 2 moderate, 0 high | 2 moderate (accepted, see below), 0 high | frontend.yml `--audit-level=high` |
| | | tests/ui, tests/api | 0 | 0 | **new** steps in frontend.yml / backend.yml |
| Maven vulnerabilities | GitHub Advisory DB (reviewed, commit `43d7804`, 2026-10-14) matched against the Boot 3.5.16 BOM versions | backend runtime + test classpath (69 artifacts) | 5 high + 6 moderate (Jackson), 1 moderate (log4j-api), 2 critical (spring-webmvc) | 2 critical (spring-webmvc, accepted, see below) | Trivy (backend.yml), dependency-review, Dependabot |
| SAST | Semgrep 1.180.0, offline rules `.semgrep/critical.yml` (25 rules) | whole repo | 0 | 0 | **new** `semgrep` job: registry packs + `.semgrep/` |
| Secrets | gitleaks 8.28.0 (`git` over 4 commits + `dir` over the working tree) | whole repo | 0 | 0 | `gitleaks` job (existing) |
| Workflows | actionlint 1.7.7 + shellcheck 0.11.0 | .github/workflows | 0 | 0 | **new** `workflow-lint` job |
| | zizmor 1.30.1 (`--offline`) | .github/workflows | 48 (38 unpinned-uses, 10 artipacked) | 0 | **new** `workflow-lint` job |
| Dockerfile | hadolint 2.12.0 | backend/Dockerfile | 0 | 0 | Semgrep `p/dockerfile` + `.semgrep/` rules, Trivy |
| Java bugs/smells | PMD 7.17.0, `quickstart` ruleset (maven-pmd-plugin 3.28.0) | backend main | 6 | 0 | **new**, `mvn verify` fails on any violation |
| Java style | Checkstyle 10.26.1, `google_checks.xml` (maven-checkstyle-plugin 3.6.0) | backend main + test | 1,053 warnings | 1,053 warnings (report-only) | **new**, `mvn verify` (never fails) |

## What was fixed

- **Jackson 2.21.4 → 2.21.7** (`jackson-bom.version` in backend/pom.xml). Fixes high-severity GHSA-cxp5-3px4-pw24, GHSA-wv8q-qhhj-9h54, GHSA-q4xh-88c3-wmh7 (databind), GHSA-7hhh-6rmp-j9qf and GHSA-p6pp-m3f8-5c89 (core), plus 6 moderates.
- **log4j-api 2.24.3 → 2.25.5** (`log4j2.version`). Fixes GHSA-qv9r-c865-cp47 (moderate). Log4j is only on the classpath through the `log4j-to-slf4j` bridge.
- **28 sonarjs findings** fixed without changing behaviour:
  - props are now `Readonly<Props>`;
  - `toHaveLength` assertions;
  - `localeCompare` sorts in tests;
  - a linear-time trailing-slash strip replaces the backtracking regex in `HttpBooksApi`;
  - complex functions were split into pure helpers: `BookForm` (`fieldErrorsFromSaveError`), `CatalogPage` (`resultsAnnouncement`, `renderEmpty`, `renderLoadMore`) and `MockApi.handle` (`parseBody`, `dispatch`).
- **6 PMD findings**:
  - `PublishedYearValidator` now returns a single boolean expression;
  - `Objects.requireNonNullElse` replaces a nested ternary;
  - the JPA constructor is now commented;
  - 3 suppressions, each with a justification: the `@SpringBootApplication` class can't be a utility class; the malformed-UUID→404 mapping drops the parse trace on purpose; `InvalidRequestException` keeps `LinkedHashMap` because the field must be Serializable and keep its order.
- **Workflows**:
  - every third-party and GitHub action is pinned to a commit SHA, with a version comment that Dependabot keeps updated;
  - every `actions/checkout` has `persist-credentials: false` (zizmor `artipacked`).

## Accepted risks

| Finding | Severity | Why accepted | Expires |
|---|---|---|---|
| spring-webmvc 6.2.19: CVE-2026-47890 / GHSA-j9f9-w8pj-32f8 (SSE fragment stream corruption), CVE-2026-47884 / GHSA-pc63-qcmh-9cmg (XsltView path limitation) | Critical | No OSS 6.2.x fix exists. The only fix is Spring Framework 7.0.9, which means migrating to Boot 4. That is a behavioural change and was handed to the orchestrator. Neither is reachable here: the code has no `SseEmitter`, no fragment rendering and no `XsltView` (grep of backend/src). Listed in `.trivyignore` with `exp:` so the Trivy gate fails again once the entry expires. | 2027-01-14 |
| react-router 6.30.6: GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in `<Link>`/`useNavigate`), GHSA-337j-9hxr-rhxg (SSR `deserializeErrors`) | Moderate | Fixed only in 7.18.0, a major upgrade. The app navigates only to static internal paths (`/`, `/books/new`) and has no SSR or hydration, so neither is reachable. CI gates at `high`, so this does not block. | 2027-01-14 |
| `Math.random` in `frontend/src/api/demoApi.ts` (demo-mode id fallback) and `tests/ui/support/data.ts` (test ISBN digits) | Info | The values aren't security tokens. Suppressed inline with a reason. | none |
| Checkstyle Google style: 1,053 warnings (899 indentation: the codebase uses 4-space indent where Google style wants 2) | Style | The brief asks for report-only. Reformatting the whole backend is churn with no defect value. | Review when a team style is chosen |

## What could not run locally (and how CI covers it)

- **Semgrep registry rulesets** (`p/default`, `p/owasp-top-ten`, `p/java`, `p/typescript`, `p/react`, `p/secrets`, `p/github-actions`, `p/dockerfile`): `semgrep.dev` is blocked by the egress policy (403). I ran the offline rules in `.semgrep/critical.yml` instead: 25 rules covering SQLi, command injection, deserialization, XXE, CORS/CSRF, DOM XSS, `eval`, token storage, TLS bypass, hard-coded keys, GitHub Actions script injection and Dockerfile root/latest/ADD. Every rule was checked against a deliberately vulnerable fixture and fired. The `semgrep` CI job runs the registry packs plus these rules, uploads SARIF and fails on ERROR-severity results.
- **osv-scanner 2.2.2**: `api.osv.dev` and the offline-DB bucket (`osv-vulnerabilities.storage.googleapis.com`) are blocked, and Maven Central is blocked too, so transitive resolution isn't possible here. Instead I matched the resolved Spring Boot 3.5.16 BOM versions against a clone of `github/advisory-database`. That is the same data osv-scanner uses for GHSA.
- **Maven** (Checkstyle, PMD, SpotBugs and the JaCoCo gate inside `mvn verify`): Maven Central is blocked. I ran Checkstyle 10.26.1 and PMD 7.17.0 standalone with the same rulesets the pom configures. The first green `Backend` run on GitHub confirms the pom wiring.

## Re-running locally

```sh
(cd frontend && npm run lint && npm audit --audit-level=moderate)   # likewise tests/ui, tests/api
semgrep scan --config .semgrep/ --metrics off --error .
gitleaks git . && gitleaks dir .
actionlint && zizmor --offline .github/workflows
hadolint backend/Dockerfile
```
