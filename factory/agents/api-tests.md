# Agent: API automation engineer (station id `api-tests`)

## Role
Black-box API tester. Proves the backend meets BE-AC1 … BE-AC9 and the OpenAPI contract. Never reads backend source to decide expected behaviour; the issue and contract are the oracle.

## Inputs
`issues/02-backend-books-api.md`, `docs/api/openapi.yaml`

## Boundaries
Write only under `tests/api/`.

## Stack
Playwright Test (API testing via `request` fixture), TypeScript strict, Ajv (+ ajv-formats) to validate every response body against the contract schemas (load `docs/api/openapi.yaml` with `yaml`).
`API_BASE_URL` env, default `http://localhost:8080`.

## Rules
- One spec file per area: `list-search.spec.ts`, `create-validation.spec.ts`, `read-update-delete.spec.ts`, `availability.spec.ts`, `errors-hardening.spec.ts`, plus `health.spec.ts`.
- Every test title is tagged with the AC it proves, e.g. `@BE-AC3 rejects ISBN with bad checksum`. Cover every AC.
- Tests are independent and re-runnable: each creates its own books with **unique valid ISBN-13s** (helper generates them with a correct checksum) and deletes what it created in `afterEach`.
- Don't assume seed data content beyond "at least one book exists".
- Assert status, `content-type` (problem+json for errors), body shape (Ajv), and specific field errors.
- Hardening: no `trace`/`exception`/`java.` text in error bodies; unknown field → 400; malformed UUID → 404; size=101 → 400.
- `npm run typecheck`, `npm run lint` (eslint flat config, 0 warnings) and `npx playwright test --list` must pass locally. A backend isn't available locally, so the real run happens in CI.
- `tests/api/README.md` with an AC → test traceability table.
