# Deployment

| Part | Where | Pipeline |
|---|---|---|
| Frontend (static SPA) | GitHub Pages: `https://<owner>.github.io/<repo>/` | `.github/workflows/frontend.yml` → `deploy-pages` |
| Backend image | GHCR: `ghcr.io/<owner>/<repo>/library-api:{sha-xxxxxxx,latest}` | `.github/workflows/backend.yml` → `docker` |
| Backend service | Render (free web service, runs the GHCR image) | `render.yaml` + `.github/workflows/backend.yml` → `deploy-render` |

Deploy jobs run only on `main` (push or manual "Run workflow"), after every quality job before them has passed.

The backend image follows one path: `docker` builds it into the runner's local Docker daemon (no push), Trivy scans
that local image and fails the job on any fixable CRITICAL/HIGH finding (`severity: CRITICAL,HIGH`,
`ignore-unfixed: true`, and `limit-severities-for-sarif: true` so the SARIF output keeps that filter; LOW/MEDIUM
findings never fail the gate), and only then are the same image's tags pushed to GHCR (no rebuild). `deploy-render` passes the pushed image's digest to Render, so Render runs exactly the
bytes Trivy scanned. Nothing is pushed, not even `latest`, when the scan fails.

## One-time setup

### 1. GitHub Pages (frontend)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Run the **Frontend** workflow on `main` (Actions → Frontend → Run workflow), or push a change under `frontend/`.
3. The site is at `https://<owner>.github.io/<repo>/`. Vite builds with `base: './'` and the app uses
   `HashRouter` (`#/`, `#/books/new`), so it works under the repository sub-path with no 404 fallback.

By default the Pages build runs in **demo mode** (in-browser mock API, "Demo data" badge). See step 5 to point it at
the live backend.

### 2. GHCR image visibility

The first `docker` run creates the package `<repo>/library-api` under your account (Profile → Packages). It is
private by default. Render pulls this image, so either open the package → **Package settings → Change visibility →
Public**, or keep it private and give Render a registry credential (step 3).

The job pushes with the built-in `GITHUB_TOKEN` (`packages: write`); no secret is needed.

### 3. Render (backend)

1. Run the **Backend** workflow on `main` once so the image exists in GHCR (the `deploy-render` job skips itself
   until the hook secret below is set).
2. In `render.yaml`, replace `OWNER/REPO` in `image.url` with your lower-case `<owner>/<repo>`. For a private package,
   create a registry credential in Render (**Settings → Registry credentials**, GHCR, a classic PAT with
   `read:packages`) named `ghcr` and uncomment the `creds` block.
3. In Render: **New → Blueprint**, connect this repository. Render reads `render.yaml` and creates the `library-api`
   web service (image runtime, free plan, health check `/actuator/health`, `PORT=8080`). Render never builds the
   Dockerfile itself.
4. When prompted, set `APP_CORS_ALLOWED_ORIGINS` (see section 6, CORS).
5. `autoDeploy` is off: deploys happen only when CI on `main` passes. In the service, open **Settings → Deploy Hook**
   and copy the URL.
6. In GitHub, **Settings → Secrets and variables → Actions**:
   - Secret `RENDER_DEPLOY_HOOK_URL` = the deploy hook URL.
   - Variable `BACKEND_URL` = the service URL, e.g. `https://library-api-xxxx.onrender.com` (no trailing slash).

`deploy-render` then calls the hook with `imgURL=ghcr.io/<owner>/<repo>/library-api@sha256:…` (the scanned image's
digest), polls `$BACKEND_URL/actuator/health` until `UP` (up to 15 min, free instances
pull and cold-start slowly), and smoke-tests `GET /api/books` → 200. Without the secret the job prints a notice and
does nothing. Without `BACKEND_URL` it triggers the deploy but skips verification.

Note: the previous instance keeps answering `UP` while Render pulls and starts the new image, so the health poll mainly proves the service is
reachable; check the Render dashboard for the new deploy's status. The free plan's H2 database is in-memory and is
reseeded with 8 books on every restart.

### 4. SonarCloud (optional)

1. Import the repository at sonarcloud.io. The organization key must equal the GitHub owner and the project key
   `<owner>_<repo>` (the defaults SonarCloud proposes); the workflow passes both.
2. Turn off **Automatic Analysis** for the project (CI analysis replaces it).
3. Add the secret `SONAR_TOKEN`. The `sonarcloud` job in `security.yml` then runs both test suites for coverage and
   uploads using `sonar-project.properties`. Without the secret it is skipped.

### 5. Point Pages at the live backend

Add the repository **variable** `API_BASE_URL` = the Render URL (same value as `BACKEND_URL`), then re-run the
Frontend workflow. The Pages build passes it as `VITE_API_BASE_URL`. Delete the variable to return to demo mode.

### 6. CORS

The browser calls the API from the Pages origin, which is the scheme + host only, no path:

```
APP_CORS_ALLOWED_ORIGINS=https://<owner>.github.io
```

Use a comma-separated list for several origins, e.g. `https://<owner>.github.io,http://localhost:5173`. Set it in the
Render service's **Environment** tab (it is declared with `sync: false` in `render.yaml`, so Render asks for it and
never overwrites it). The Dockerfile default is `http://localhost:5173`.

## Secrets and variables

| Name | Kind | Needed for | Required |
|---|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | secret | `deploy-render` | only to deploy to Render |
| `BACKEND_URL` | variable | `deploy-render` health poll + smoke test | with the hook |
| `API_BASE_URL` | variable | Pages build against the live API | no (demo mode) |
| `SONAR_TOKEN` | secret | `sonarcloud` job | no |
| `GITLEAKS_LICENSE` | secret | `gitleaks` job | only if the repo is owned by an organization |

Also enable **Settings → Code security → Dependency graph** (on by default for public repos) for
`dependency-review`, and keep code scanning on so CodeQL and Trivy SARIF results appear under **Security**.
