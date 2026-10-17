# Agent: Backend developer (station id `be-dev`)

## Role
Senior Java 21 / Spring Boot engineer. Implements the backend issue end to end, including unit tests.

## Inputs
- Issue: `issues/02-backend-books-api.md`
- Contract: `docs/api/openapi.yaml` (must match exactly: paths, status codes, field names, problem titles)

## Boundaries
- Write **only** under `backend/`.
- No Lombok. Use Java records for DTOs. Constructor injection only. No field injection, no `@Autowired` on fields.
- Never leak stack traces or exception class names in responses.

## Stack
Maven, `spring-boot-starter-parent` latest patched 3.x release, Java 21. Starters: web, validation, data-jpa, actuator, test. H2 runtime.
Plugins: jacoco (check ≥ 0.80 line coverage, bound to `verify`, exclude the `Application` class), spotbugs-maven-plugin + findsecbugs-plugin (fail on Medium+, run in `verify`), maven-enforcer (requireJavaVersion 21, requireMavenVersion 3.9, banDuplicatePomDependencyVersions), maven-surefire.

## Package layout (`com.example.library`)
```
LibraryApplication
book/ Book (JPA entity, UUID id, unique isbn), Genre, BookRepository (Spring Data + JpaSpecificationExecutor or JPQL search),
      BookService, BookController, dto/BookInput (record + validation), dto/BookResponse, dto/BookPage, dto/AvailabilityRequest
validation/ Isbn13 (annotation) + Isbn13Validator, PublishedYear (≤ current year via injected java.time.Clock)
error/ ApiExceptionHandler (@RestControllerAdvice → ProblemDetail), BookNotFoundException, DuplicateIsbnException
config/ CorsConfig (APP_CORS_ALLOWED_ORIGINS), ClockConfig, JacksonConfig (FAIL_ON_UNKNOWN_PROPERTIES = true)
```
- `src/main/resources/application.yml`: H2 in-memory, `spring.jpa.open-in-view: false`, actuator exposes health only, `server.error.include-stacktrace: never`, `spring.mvc.problemdetails.enabled: true`.
- `data.sql` (or a CommandLineRunner) seeding 8 realistic books with **valid ISBN-13s** (verify every checksum).
- Malformed UUID in path → 404 "Book not found" (not 400/500). `size > 100` → 400.
- Sorting: title case-insensitive ascending.
- Duplicate ISBN check on create and on update (excluding self) → 409. Also catch DataIntegrityViolationException → 409.

## Tests (JUnit 5)
- `Isbn13ValidatorTest` (valid, bad checksum, letters, 12/14 digits, null handling)
- `BookServiceTest` (Mockito)
- `BookControllerTest` (`@WebMvcTest` + MockMvc): every status code in the contract, problem bodies, Location header, unknown field → 400
- `BookRepositoryTest` (`@DataJpaTest`): search by q/genre/available
- `LibraryApplicationTests` context loads

## Also
- `backend/Dockerfile` (multi-stage: maven:3.9-eclipse-temurin-21 build → eclipse-temurin:21-jre-alpine run as non-root user, HEALTHCHECK on /actuator/health)
- `backend/README.md`

## Note on this environment
Maven Central may be unreachable in the agent workspace. If `mvn` cannot download, don't fight it: write the code carefully (imports, generics, annotations, records), self-review every file for compile errors, and report `status: "ci"` so the dashboard shows it will be verified in GitHub Actions.
