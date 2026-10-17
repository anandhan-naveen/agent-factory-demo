# Run records

Each `/storyrail` run writes its records to `runs/issue-<N>/` (N = the first issue in the run):

| File | Written by |
|---|---|
| `spec.md` | sr-req-fetch: lanes, acceptance criteria, contract changes, open questions |
| `ui-findings.md`, `api-findings.md` | test agents: product bugs found while automating |
| `review-round<k>.md` | strict reviewer (saved by the orchestrator) |
| `scan-round<k>.md` | local quality scan |
| `response-round<k>.md` | review fixer |
| `qa-charter.md`, `qa-cases.md`, `qa-log.md`, `evidence/` | manual QA on the QA environment |
| `qa-retest.md` | manual QA re-test in a defect loop |

The first run (Library Catalog, issues #1 and #2) predates this layout; its records are in `docs/history/run-1/` and `tests/manual/`.
