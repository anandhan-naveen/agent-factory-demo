# Response to strict review, round 1 (backend + API tests + CI half)

Fixer: fresh review-fixer agent. Scope: R-BE-01..07, R-CI-01..02 (9 findings). All 9 fixed, none disputed.

| ID | Status | What changed (files) | Test added |
|---|---|---|---|
| R-BE-01 | fixed | `Book` constructor truncates `createdAt` to **millis** (one place, so it covers `BookService.create` and `DataSeeder`; ms survives the H2 `timestamp(6)` column and any DB with >= ms precision). `backend/.../book/Book.java` | `BookServiceTest.createTruncatesCreationTimeToMillisSoItSurvivesTheDatabaseRoundTrip` (clock with nanos), `BookRepositoryTest.createdAtSurvivesTheRoundTripExactly`, `LibraryApplicationTests.createdAtFromPostEqualsCreatedAtFromGet` (POST vs GET by id and list, full context) |
| R-BE-02 | fixed | `JacksonConfig` is the single source of strictness: `FAIL_ON_UNKNOWN_PROPERTIES` on, `MapperFeature.ALLOW_COERCION_OF_SCALARS` and `DeserializationFeature.ACCEPT_FLOAT_AS_INT` off. Removed the duplicate `spring.jackson` block from `application.yml`. Errors surface as `errors.<field> = "has an invalid type or format"` via the existing `MismatchedInputException` branch. | `BookControllerTest.patchAvailabilityRejectsNonBooleanScalars` (`2`, `0`, `1`, `"true"`, `1.5`), `createRejectsYearAsString` (`"1925"`), `createRejectsFractionalYear` (`1925.7`); `LibraryApplicationTests.availabilityRejectsNumberInFullContext`; API: `create-validation.spec.ts` cases "publishedYear as a numeric string" / "with a fraction" (availability.spec.ts:29 already covers `{available:2}`) |
| R-CI-01 | fixed | `spring-boot-starter-parent` 3.3.5 → **3.5.16** (latest 3.x, released 2026-06-25, last OSS 3.5 release). Boot 3.5.16 manages Tomcat **10.1.55**, which is still affected by CVE-2026-68525 (FORM auth bypass, CVSS 9.1 per CISA-ADP, fixed in 10.1.58) and further CVEs fixed in 10.1.59, so `<tomcat.version>10.1.60</tomcat.version>` (released 2026-09-16, 4 weeks ago) is pinned. `@MockBean` (deprecated since 3.4) replaced by `@MockitoBean`. Checked: no other removed/deprecated APIs used (ResponseEntityExceptionHandler overrides, `Jackson2ObjectMapperBuilderCustomizer`, `@WebMvcTest`/`@DataJpaTest`/`TestEntityManager` are unchanged in 3.5); no `-Werror` in the pom; JaCoCo 0.8.12, spotbugs-maven-plugin 4.8.6.4 and findsecbugs 1.13.0 all support Java 21 class files. `backend/pom.xml`, `BookControllerTest.java`, `backend/README.md` | Existing suite; gate is `mvn verify` + Trivy in CI |
| R-BE-03 | fixed | `BookController.list` rejects `(long) page * size > Integer.MAX_VALUE` with 400 `errors.page = "is too large for the requested size"` (checked only when page/size are otherwise valid). | `BookControllerTest.listRejectsPageWhoseOffsetOverflowsInt` (21474837 x 100) and `listAcceptsLargestPageWhoseOffsetFitsInt` (21474836 x 100); API: `list-search.spec.ts` two new tests (400 on page, and empty 200 at the boundary) |
| R-CI-02 | fixed | `docker` job: build with `load: true, push: false` → Trivy scans the local image → SARIF upload → login → `docker push` of the same scanned tags (no rebuild) → job output `image` = digest-pinned `RepoDigests[0]`. `deploy-render` posts the hook with `imgURL=<that digest>`. `render.yaml` switched from `runtime: docker` (Render rebuilt the Dockerfile) to `runtime: image` on `ghcr.io/OWNER/REPO/library-api` (placeholder + optional `creds`). `docs/DEPLOYMENT.md` documents the scan-then-push path, the image-backed Render setup and private-package credentials. `.github/workflows/backend.yml`, `render.yaml`, `docs/DEPLOYMENT.md` | actionlint 0 findings |
| R-BE-04 | fixed | `@DynamicUpdate` on `Book`: PUT's UPDATE writes only changed columns, so it no longer overwrites a concurrently PATCHed `available`. `backend/.../book/Book.java` | `BookRepositoryTest.updateDoesNotOverwriteAvailabilityChangedConcurrently` (native UPDATE of `available` behind Hibernate's back, then PUT-style update + flush; `available` stays false) |
| R-BE-05 | fixed | `Isbn13Validator` returns true for blank, so `@NotBlank` is the only violation for `""` / `"   "`. `backend/.../validation/Isbn13Validator.java` | `BookControllerTest.createBlankIsbnReportsOnlyNotBlank` (exact `errors.isbn = "must not be blank"`), `Isbn13ValidatorTest.treatsBlankAsValidSoThatOnlyNotBlankReportsIt` (replaces `rejectsEmptyString`), `checksumHelperRejectsEmptyString`; API: `create-validation.spec.ts` "empty ISBN" |
| R-BE-06 | fixed | `support/contract.ts` parses the whole contract and throws on any YAML error (fallback removed; `docs/api/openapi.yaml` parses with 0 errors today). Stale README paragraph removed. `tests/api/support/contract.ts`, `tests/api/README.md` | n/a (a broken contract now fails every run) |
| R-BE-07 | fixed | `CURRENT_YEAR = new Date().getUTCFullYear()`. `tests/api/support/data.ts` | n/a |

## Version sources (R-CI-01)

- Spring Boot 3.5.16, "the last OSS release of the 3.5.x generation": https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/
- Boot 3.5.16 → tomcat-embed-core 10.1.55: https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-starter-tomcat/3.5.16/dependencies
- tomcat-embed-core 10.1.55 flagged (CVE-2026-68525, -65905, -65182); 10.1.59 (2026-08-21) and 10.1.60 (2026-09-16) have none listed: https://mvnrepository.com/artifact/org.apache.tomcat.embed/tomcat-embed-core
- CVE-2026-68525 affects 10.1.0-M1..10.1.57, fixed in 10.1.58, CVSS 9.1 (CISA-ADP): https://www.suse.com/security/cve/CVE-2026-68525.html
- Tenable: Tomcat 10.1.0.M1 < 10.1.59, multiple CVEs: https://zh-tw.tenable.com/plugins/nessus/339371/changelog/1.2

## Checks run here

- `tests/api`: `npm run lint` (0 warnings), `npm run typecheck` (clean), `npx playwright test --list` → 110 tests in 6 files.
- `actionlint`: 0 findings.
- Backend: Maven Central is blocked in this workspace (403), so `mvn verify` was **not** run. `Book.java` was compiled with javac 21 against stub annotations and the truncation and overflow arithmetic were executed (`…00.123456789Z` → `…00.123Z`; 21474837x100 overflows, 21474836x100 does not). Every other changed Java file was self-reviewed.

## Residual risk for the orchestrator

1. **Compile/test not proven** until CI runs `mvn verify` (Jackson coercion behaviour and the native-UUID bind in the `@DynamicUpdate` test are the parts most worth watching).
2. **Trivy may still flag other managed libraries.** Boot 3.5.16 is end of OSS support; any CRITICAL/HIGH fixed after June 2026 in Spring Framework 6.2.x (OSS line also ended; later fixes are commercial-only) or other managed jars would need further `<x.version>` overrides or the Boot 4.x migration. Only Tomcat could be verified from here.
3. Render setup now needs `OWNER/REPO` filled into `render.yaml` and a public GHCR package (or a registry credential); documented in `docs/DEPLOYMENT.md` §2–3.
