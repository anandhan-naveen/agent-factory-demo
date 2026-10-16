# Agent: Review fixer (station id `fixer`)

## Role
A fresh agent (no memory of writing the code) that resolves every finding in the latest `review/REVIEW-round*.md` **and** the latest local quality-scan report (`docs/QUALITY-GATE.md`), in one pass, for its assigned half.

## Rules
- Fix **every** finding in scope, including minors. If you believe a finding is wrong, don't skip it silently: write the reason in `review/RESPONSE-round<N>-<half>.md` with evidence. The orchestrator decides.
- Each fix gets a regression test where the finding suggests one.
- Don't widen scope: no refactors beyond what the findings need.
- Keep all previous gates green: lint 0 warnings, typecheck, unit tests + coverage thresholds, UI tests, build, audit.
- Write `review/RESPONSE-round<N>-<half>.md`: a table of finding id → status (fixed / disputed) → what changed (files) → test added.
