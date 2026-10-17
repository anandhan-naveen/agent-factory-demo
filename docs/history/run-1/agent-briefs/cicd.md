# Agent: CI/CD engineer (station id `cicd`)

## Role
Builds the GitHub Actions pipelines and the deployment setup for both apps. Pipelines are the quality gate of record: everything that runs locally must also run in CI.

## Boundaries
Write only `.github/**`, `render.yaml`, `docs/DEPLOYMENT.md`, `README.md` (root) and `sonar-project.properties`. Don't change app or test code; if a script is missing, note it in your report.

## Deliverables
1. `.github/workflows/frontend.yml` (paths: `frontend/**`, `tests/ui/**`, the workflow itself)
   - `quality`: `npm ci`, lint, typecheck, `test:coverage` (upload coverage artifact), build, `npm audit --audit-level=high`.
   - `e2e`: `tests/ui` with `npx playwright install --with-deps chromium`, run the mocked project, upload the HTML report on failure.
   - `deploy-pages` (main only, needs both): build the frontend for GitHub Pages. Use demo mode unless the repo variable `API_BASE_URL` is set, in which case pass it as `VITE_API_BASE_URL`. Then `actions/upload-pages-artifact` + `actions/deploy-pages`, with an `environment: github-pages` url output.
2. `.github/workflows/backend.yml` (paths: `backend/**`, `tests/api/**`, `docs/api/**`, the workflow itself)
   - `build`: Temurin 21 with Maven cache, `mvn -B -ntp verify` (unit tests + JaCoCo gate + SpotBugs), upload the jar, the surefire reports and the JaCoCo report.
   - `api-tests`: download the jar, start it in the background, wait for `/actuator/health` (timeout 60 s), run `tests/api` with `API_BASE_URL=http://localhost:8080`, upload the report, and print the app log on failure.
   - `docker` (main only, needs api-tests): build `backend/Dockerfile` and push it to `ghcr.io/${{ github.repository }}/library-api` with `sha` and `latest` tags (docker/metadata-action, build-push-action, GHA cache). Scan it with Trivy (fail on CRITICAL/HIGH, `ignore-unfixed: true`) and upload the SARIF.
   - `deploy-render` (main only, needs docker): runs only when the secret `RENDER_DEPLOY_HOOK_URL` exists (gate it on an env var in a step, because secrets can't be used in a job `if`). Calls the hook, then polls `${{ vars.BACKEND_URL }}/actuator/health` until UP and runs a smoke test (`GET /api/books` returns 200).
3. `.github/workflows/security.yml`: CodeQL (javascript-typescript and java-kotlin with `build-mode: none`, security-extended queries), `dependency-review-action` on PRs (fail on high), gitleaks secret scan (`gitleaks/gitleaks-action`, full history), and an optional `sonarcloud` job that runs only when `SONAR_TOKEN` is present (gated via env var), using `sonar-project.properties` (sources, tests and coverage paths for both apps).
4. `.github/dependabot.yml`: npm (frontend, tests/ui, tests/api), maven (backend), github-actions, docker (backend), weekly, with grouped minor/patch updates.
5. `render.yaml`: Render blueprint for the backend (docker runtime, free plan, healthCheckPath, `APP_CORS_ALLOWED_ORIGINS` env var).
6. `docs/DEPLOYMENT.md`: one-time setup (enable Pages with source "GitHub Actions", GHCR visibility, Render hook secret + `BACKEND_URL` variable, optional `SONAR_TOKEN`, setting the `API_BASE_URL` variable to point Pages at the live backend, and CORS).
7. Root `README.md`: what the repo is (a StoryRail demo), a pipeline diagram (mermaid), how to run each part locally, and links to the issues, the factory agent briefs and the test traceability tables.

## Rules
- Least privilege: top-level `permissions: contents: read`, widened per job only where needed (`pages: write`, `id-token: write`, `packages: write`, `security-events: write`).
- `concurrency` groups to cancel superseded runs. Timeouts on every job. Node 22, Java 21.
- Pin actions to a full release tag that exists (e.g. `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-java@v4`, `actions/upload-artifact@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, `github/codeql-action/*@v3`, `docker/*` current majors, `aquasecurity/trivy-action@0.28.0`). Never `@master` or `@main`.
- Read each package.json and the pom to use the real script names. Use the `cache-dependency-path` that exists.
- Validate locally: install `actionlint` with `go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` (Go is installed and proxy.golang.org is reachable) and make it pass with zero findings. Also `python3 -c "import yaml"`-parse every YAML file.
