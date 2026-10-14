# Books API: automated contract tests

Black-box Playwright API tests for `issues/02-backend-books-api.md` (BE-AC1 … BE-AC9) and
`docs/api/openapi.yaml`. Every response body is validated with Ajv against the contract
schemas loaded from the YAML. Every error is checked for `application/problem+json`, a matching
`status` field, the expected `title`, and no leaked internals.

```bash
cd tests/api
npm ci
API_BASE_URL=http://localhost:8080 npx playwright test   # default URL shown
npm run typecheck && npm run lint && npx playwright test --list
```

No browser is needed (API only). In CI, start the built jar, wait for `/actuator/health`, then run
`npx playwright test`. With `CI` set, the reporters write `playwright-report/` and `test-results/junit.xml`.

**Isolation.** Each test creates its own books (unique, checksum-valid ISBN-13s and a random
search token in the title) through the `books` fixture, which deletes them on teardown after
each test. The only assumption about seed data is that at least one book exists.
Run one criterion with `npx playwright test --grep @BE-AC3`.

## Traceability

| AC | What is proven | Spec(s) |
|---|---|---|
| BE-AC1 | Page envelope + BookPage schema; defaults page 0 / size 20; case-insensitive title sort (own books + whole first page); paging maths; size 100 ok; size 101/1000/0/-1, page -1, non-numeric → 400 problem+json; seed has ≥ 1 book | `list-search.spec.ts`, `health.spec.ts` |
| BE-AC2 | `q` substring of title and of author, case-insensitive; no match → empty page; `genre` exact enum; unknown genre → 400; `available` true/false; all three combined | `list-search.spec.ts` |
| BE-AC3 | 201 + `Location` + Book schema + `available: true`; all six genres; boundaries (title 1/200, author 1/120, year 1450/current, check digit 0); rejects blank/too-long title and author, bad checksum, 12/14 digits, hyphens, letters, ISBN-10, year 1449 / next year, unknown and lower-case genre, each missing field | `create-validation.spec.ts` |
| BE-AC4 | 400 `title: "Validation failed"`, `errors` maps each failing field → non-empty message; several fields at once; `{}` lists all five; rejected book is not persisted | `create-validation.spec.ts`, `read-update-delete.spec.ts` |
| BE-AC5 | Duplicate ISBN on POST and PUT → 409 `Duplicate ISBN`; original untouched; keeping your own ISBN on PUT is fine | `create-validation.spec.ts`, `read-update-delete.spec.ts` |
| BE-AC6 | Unknown UUID → 404 `Book not found` for GET/PUT/PATCH/DELETE; malformed ids (`not-a-uuid`, `12345`, non-hex, SQL-like) → 404, not 500, on every verb | `read-update-delete.spec.ts`, `availability.spec.ts`, `errors-hardening.spec.ts` |
| BE-AC7 | PUT replaces all editable fields, keeps id/createdAt/available, same validation as POST, missing field → 400; PATCH changes only `available` (false→true round trip equals original), idempotent; bad PATCH bodies → 400 and nothing changes | `read-update-delete.spec.ts`, `availability.spec.ts` |
| BE-AC8 | DELETE → 204 with empty body, then GET 404; gone from the list; second DELETE 404; ISBN reusable | `read-update-delete.spec.ts` |
| BE-AC9 | Unknown field on POST/PUT/PATCH (including `id` and `available`) → 400; malformed JSON, wrong type, array body → 400 problem+json; no `trace`/`exception`/`java.`/framework names/stack frames in any 400/404/409 body | `errors-hardening.spec.ts`, `availability.spec.ts`, `create-validation.spec.ts` |
| (health) | `GET /actuator/health` → 200 `{"status":"UP"}` (tag `@BE-health`) | `health.spec.ts` |

## Contract interpretations

- **openapi.yaml line 27 is not valid YAML** (`description: /api/books/{id}` has an unquoted `{` inside a
  flow mapping). `support/contract.ts` falls back to parsing only `components:` and logs a warning.
  Quoting that value removes the warning.
- `Book` is `allOf: [BookInput, …]`, but `BookInput` has `additionalProperties: false`, which literally
  rejects `id`. Responses are validated against the flattened union: all documented fields, no extras.
- `available` is not in `BookInput`, so PUT leaves it unchanged, and sending it on POST/PUT is an unknown field (400).
- "Trimmed, not blank" is tested as: a whitespace-only title or author → 400. Whether stored values are trimmed is not asserted.
- An invalid `genre` in a body is expected as the field error `errors.genre` (BE-AC3/4), not a generic parse error.
- Bad query params, malformed JSON and unknown fields must return 400 problem+json. Their `title` is not asserted.
