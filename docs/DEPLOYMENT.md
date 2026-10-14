# Deployment

| Part | Where | Pipeline |
|---|---|---|
| Frontend (static SPA) | GitHub Pages: `https://<owner>.github.io/<repo>/` | `.github/workflows/frontend.yml` → `deploy-pages` |
| Backend image | GHCR: `ghcr.io/<owner>/<repo>/library-api:{sha-xxxxxxx,latest}` | `.github/workflows/backend.yml` → `docker` |
| Backend service | Render (free web service, Docker) | `render.yaml` + `.github/workflows/backend.yml` → `deploy-render` |

Deploy jobs run only on `main` (push or manual "Run workflow"), after every quality job before them has passed.

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
private by default. To let anyone pull it (or to let Render pull it without credentials if you switch Render to an
image deploy), open the package → **Package settings → Change visibility → Public**.

The job pushes with the built-in `GITHUB_TOKEN` (`packages: write`); no secret is needed.

### 3. Render (backend)

1. In Render: **New → Blueprint**, connect this repository. Render reads `render.yaml` and creates the `library-api`
   web service (Docker runtime, `backend/Dockerfile`, free plan, health check `/actuator/health`, `PORT=8080`).
2. When prompted, set `APP_CORS_ALLOWED_ORIGINS` (see step 6).
3. `autoDeploy` is off: deploys happen only when CI on `main` passes. In the service, open **Settings → Deploy Hook**
   and copy the URL.
4. In GitHub, **Settings → Secrets and variables → Actions**:
   - Secret `RENDER_DEPLOY_HOOK_URL` = the deploy hook URL.
   - Variable `BACKEND_URL` = the service URL, e.g. `https://library-api-xxxx.onrender.com` (no trailing slash).

`deploy-render` then calls the hook, polls `$BACKEND_URL/actuator/health` until `UP` (up to 15 min, free instances
build and cold-start slowly), and smoke-tests `GET /api/books` → 200. Without the secret the job prints a notice and
does nothing. Without `BACKEND_URL` it triggers the deploy but skips verification.

Note: the previous instance keeps answering `UP` while Render builds, so the health poll mainly proves the service is
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
