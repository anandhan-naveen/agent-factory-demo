# Library Catalog – Books API (backend)

Spring Boot 3.5 (3.5.16, Tomcat pinned to 10.1.60) / Java 21 REST API for the Library Catalog. The contract is
[`docs/api/openapi.yaml`](../docs/api/openapi.yaml); the user story is
[`issues/02-backend-books-api.md`](../issues/02-backend-books-api.md).

## Run

```bash
mvn spring-boot:run                      # http://localhost:8080
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,https://catalog.example.com mvn spring-boot:run
```

Or with Docker:

```bash
docker build -t library-backend .
docker run -p 8080:8080 -e APP_CORS_ALLOWED_ORIGINS=http://localhost:5173 library-backend
```

The in-memory H2 database is seeded with 8 sample books on startup (`DataSeeder`; disable with
`APP_SEED_ENABLED=false`).

## Endpoints

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/books?q=&genre=&available=&page=0&size=20` | 200 `BookPage` | 400 |
| GET | `/api/books/{id}` | 200 | 404 |
| POST | `/api/books` | 201 + `Location` | 400, 409 |
| PUT | `/api/books/{id}` | 200 | 400, 404, 409 |
| PATCH | `/api/books/{id}/availability` | 200 | 400, 404 |
| DELETE | `/api/books/{id}` | 204 | 404 |
| GET | `/actuator/health` | 200 `{"status":"UP"}` | |

Errors are `application/problem+json` with these titles:

| Status | `title` | Notes |
|---|---|---|
| 400 | `Validation failed` | `errors` maps field/parameter → message (invalid body, unknown JSON field, bad query param, `size` outside 1–100) |
| 404 | `Book not found` | also for a malformed UUID |
| 409 | `Duplicate ISBN` | on create, and on update when another book has the ISBN |
| 500 | `Internal Server Error` | generic detail only; no stack traces or class names |

Results are sorted by title (case-insensitive). `q` is a case-insensitive substring of title or
author; `genre` and `available` are exact filters; all three combine.

## Build and quality gates

```bash
mvn verify
```

`verify` runs: Maven Enforcer (Java 21, Maven 3.9+, no duplicate dependency versions), unit and
slice tests, JaCoCo (line coverage ≥ 80 %, `LibraryApplication` excluded) and SpotBugs +
FindSecBugs (fails on Medium and above; known Spring false positives are listed in
`spotbugs-exclude.xml`).

## Layout

```
com.example.library
├── LibraryApplication
├── book/        Book (entity), Genre, BookRepository, BookSpecifications, BookService, BookController
│   └── dto/     BookInput, BookResponse, BookPage, AvailabilityRequest (records)
├── validation/  @Isbn13 + Isbn13Validator + IsbnChecksum, @PublishedYear + PublishedYearValidator (uses Clock)
├── error/       ApiExceptionHandler, BookNotFoundException, DuplicateIsbnException, InvalidRequestException
└── config/      ClockConfig, CorsConfig, JacksonConfig, DataSeeder
```

## Tests

| Class | Kind | Covers |
|---|---|---|
| `Isbn13ValidatorTest`, `PublishedYearValidatorTest` | plain JUnit | checksum, letters, 12/14 digits, null, future year |
| `BookServiceTest` | Mockito | create/update/patch/delete rules, duplicates, not-found, paging and sort |
| `BookControllerTest` | `@WebMvcTest` | every contract status code, problem bodies, `Location`, unknown fields, CORS |
| `BookRepositoryTest` | `@DataJpaTest` | search by q / genre / available, sort, paging, unique ISBN |
| `LibraryApplicationTests` | `@SpringBootTest` | context, seed data, health, full CRUD lifecycle |
