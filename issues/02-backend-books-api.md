---
title: "[BE] Books REST API with validation"
labels: [backend, user-story]
---

## User story

**As a** catalog front end
**I want** a REST API to list, search, create, update, delete and loan-toggle books
**So that** the Library Catalog screen has a reliable, validated source of truth.

## Context

- Tech: Java 21, Spring Boot 3.x (latest patched release), Maven, Spring Web, Spring Data JPA, Bean Validation, H2 (in-memory, seeded with sample books), Actuator.
- Contract (source of truth for FE and tests): `docs/api/openapi.yaml`.
- Errors use RFC 7807 `application/problem+json` (Spring `ProblemDetail`).
- CORS origins configured via `APP_CORS_ALLOWED_ORIGINS` (comma-separated). Default: `http://localhost:5173`.

## Endpoints

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/books?q=&genre=&available=&page=0&size=20` | 200 page of books | 400 bad params |
| GET | `/api/books/{id}` | 200 | 404 |
| POST | `/api/books` | 201 + `Location` header | 400, 409 duplicate ISBN |
| PUT | `/api/books/{id}` | 200 | 400, 404, 409 |
| PATCH | `/api/books/{id}/availability` body `{ "available": bool }` | 200 | 400, 404 |
| DELETE | `/api/books/{id}` | 204 | 404 |
| GET | `/actuator/health` | 200 `{"status":"UP"}` | |

## Acceptance criteria

| ID | Criterion |
|---|---|
| BE-AC1 | `GET /api/books` returns `{ items, page, size, totalItems, totalPages }`, sorted by title (case-insensitive). The default page size is 20 and the maximum is 100; larger values return 400. |
| BE-AC2 | `q` matches title or author, case-insensitive substring. `genre` filters by exact enum. `available` filters by availability. All three combine. |
| BE-AC3 | `POST /api/books` validates: title 1–200, author 1–120 (trimmed, not blank), ISBN-13 digits only with valid checksum, publishedYear 1450..current year, genre one of `FICTION, NON_FICTION, SCIENCE, HISTORY, TECHNOLOGY, CHILDREN`. New books are `available: true`. |
| BE-AC4 | Validation failures return 400 problem+json with `title: "Validation failed"` and an `errors` object mapping field → message. |
| BE-AC5 | A duplicate ISBN returns 409 problem+json with `title: "Duplicate ISBN"`. |
| BE-AC6 | An unknown id returns 404 problem+json with `title: "Book not found"`. A malformed UUID also returns 404 (not 500). |
| BE-AC7 | `PUT` replaces all editable fields with the same validation. `PATCH …/availability` only changes `available`. |
| BE-AC8 | `DELETE` returns 204, after which `GET` returns 404. |
| BE-AC9 | No stack traces or internal class names in any error response. Unknown fields in a JSON body are rejected with 400. |

## Testing (Definition of Done)

- **Unit tests** (JUnit 5, Mockito, MockMvc `@WebMvcTest`, `@DataJpaTest`): service rules, validators (ISBN checksum), controller status codes and error bodies. JaCoCo line coverage ≥ 80 %, enforced in the build.
- **API automation** (`tests/api`, Playwright API testing): black-box tests of every endpoint and BE-AC1 … BE-AC9 against a running instance (`API_BASE_URL`). Runs in CI against the freshly built jar.
- Static analysis: Maven Enforcer, SpotBugs (+ FindSecBugs) clean; `mvn verify` green. No secrets in code.
