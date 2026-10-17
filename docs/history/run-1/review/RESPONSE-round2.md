# Response to strict review, round 2

All 6 findings fixed; none disputed.

| ID | Status | What changed (files) | Test added |
|---|---|---|---|
| R2-CI-01 | fixed | `.github/workflows/backend.yml`: Trivy step gets `limit-severities-for-sarif: true`, so the SARIF run keeps `severity: CRITICAL,HIGH` and LOW/MEDIUM never fail the gate. `docs/DEPLOYMENT.md` and `docs/QUALITY-GATE.md` now spell out the exact filter (`CRITICAL,HIGH` + `ignore-unfixed` + `limit-severities-for-sarif`). | n/a (CI config); actionlint 0, zizmor 0 findings |
| R2-FE-01 | fixed | `.github/workflows/security.yml`: `semgrep` and `workflow-lint` jobs install with `pipx install "<pkg>==<pinned>"` (semgrep 1.180.0, actionlint-py 1.7.7.23, shellcheck-py 0.11.0.1, zizmor 1.30.1); no `pip install --user` left. `docs/QUALITY-GATE.md` notes the pipx install. | n/a (CI config); actionlint 0, zizmor 0 findings |
| R2-BE-01 | fixed | `backend/.../config/JacksonConfig.java`: `postConfigurer` sets `coercionConfigFor(LogicalType.Textual)` to `CoercionAction.Fail` for `CoercionInputShape.Integer`, `Float`, `Boolean` (`ALLOW_COERCION_OF_SCALARS` does not cover Textual). Error surfaces as `InvalidFormatException` with a field path, so the existing handler returns 400 + `errors.<field>` = "has an invalid type or format". Behaviour checked against jackson-databind 2.16.1 locally (same API in 2.21): isbn number, title int/float, author boolean all rejected with the right path. | `BookControllerTest.createRejectsNonStringScalarsForStringFields`, `updateRejectsNumericIsbn`; `LibraryApplicationTests.stringFieldsRejectNonStringScalarsInFullContext`; tests/api `create-validation.spec.ts` rows (ISBN as number, title as int/float, author as boolean) and `read-update-delete.spec.ts` PUT rows (ISBN as number, author as boolean) |
| R2-FE-02 | fixed | `frontend/src/hooks/useBooks.ts`: `loadMore` early-returns while page 0 is loading (synchronous ref); when page 0 applies, the generation is bumped and any in-flight load-more is aborted; a load-more response keeps the local `totalItems` if `mutationSeq` changed while it ran. `CatalogPage.tsx`: Load more is `aria-disabled` and inert while `loading || loadingMore`. | `useBooks.test.ts`: 3 `R2-FE-02` tests (no-op during new-filter load then correct paging; reload aborts in-flight loadMore; local totalItems kept after delete); `CatalogPage.test.tsx`: Load more aria-disabled and inert during new-filter load |
| R2-FE-03 | fixed | `frontend/src/components/CatalogPage.test.tsx:215`: `toBeEnabled()` → `toHaveAttribute('aria-disabled', 'false')`. Other jest-dom `toBeEnabled` (AddBookPage `save-book`) targets a natively `disabled` button, so it is correct; `not.toBeDisabled()` at the R-FE-03 test is intentional (checks it is not natively disabled). Playwright's `toBeEnabled` honours `aria-disabled`, so tests/ui is unaffected. | the assertion itself |
| R2-BE-02 | fixed | `backend/src/test/.../LibraryApplicationTests.java`: books created by a test are tracked and removed in `@AfterEach` via `BookRepository.deleteAllById` (missing ids are a no-op in Spring Data JPA 3), covering `fullBookLifecycle` and `createdAtFromPostEqualsCreatedAtFromGet`. | cleanup hook itself |

## Gates run here
- frontend: lint 0, typecheck ok, 119 unit tests pass (coverage 98.3% stmts / 96.6% branches), build ok
- tests/ui: lint 0, typecheck ok, 66/66 Playwright pass
- tests/api: lint 0, typecheck ok, `--list` 116 tests
- actionlint 0; zizmor `--offline --min-severity low`: no findings
- backend: not compiled here (Maven Central blocked); must run `mvn -B -ntp verify` in CI.
