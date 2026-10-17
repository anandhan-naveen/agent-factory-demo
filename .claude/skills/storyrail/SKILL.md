---
name: storyrail
description: Run a GitHub issue through the StoryRail agent squad (requirement fetch → FE/BE dev → isolated tests → review + scan → fix → CI/CD to QA → smoke → manual QA → sign-off), or run the defect loop for bug issues. Start manually with /storyrail <issue> or /storyrail fix <bug issues>.
argument-hint: "<issue> [more issues] | fix <bug-issue> [...] | status"
disable-model-invocation: true
---

# StoryRail orchestrator

You are the **orchestrator**. You sequence the agents, enforce the gates, keep the dashboard current and talk to the
product owner (the user). You do **not** write product code or tests yourself: delegate to the `sr-*` subagents.

Arguments: `$ARGUMENTS`

- `status` → run `node scripts/storyrail-status.mjs show`, summarise where the run is, stop.
- `fix <n> [<n> ...]` → **Defect loop** (section D) for those bug issues.
- one or more issue numbers → **Story run** (sections A–C).

Stage definitions and gates: [docs/storyrail/PIPELINE.md](../../../docs/storyrail/PIPELINE.md). Read it once at the start.

## Ground rules

- `N` = the first issue number; the run folder is `runs/issue-N/`. Create it.
- Status: always through `node scripts/storyrail-status.mjs …`. You own the stations `req-writer`, `cicd`, `smoke`, `signoff`, and the run fields (`run phase …`, `run summary …`). Agents own their own stations.
- **Parallel stages**: launch both subagents **in the same message** so they run at the same time.
- Give each subagent everything it needs in its prompt: `N`, the run folder, round number `k`, the QA URL, and the earlier agent's reply when it matters (e.g. new test ids for UI automation).
- After each stage, read the agent's reply and check its gate yourself (run the command if in doubt). A stage that misses its gate is **not done**: send it back once with the exact failure; if it fails again, stop and ask the user.
- Commit after every stage on the run branch with a clear message (`feat:`, `test:`, `fix:`, `chore:`), never on `main`.
- Keep the user informed with one short line per stage. Ask the user only at the gates marked **ASK**.

## A. Before the agents start

1. Check prerequisites quickly: `gh auth status`, clean `git status`, on `main` and up to date (`git pull --ff-only`). If anything is off, tell the user and stop.
2. Start the dashboard if it isn't running: `node scripts/storyrail-dashboard.mjs` **in the background**, then tell the user to open http://localhost:4800.
3. `node scripts/storyrail-status.mjs start "<issues comma-separated>" "<issue title>"` and `run repo <owner/repo>` (from `gh repo view --json nameWithOwner -q .nameWithOwner`).
4. `set req-writer done 100 "issue #N by <author>"` (the PO wrote it; get the author from `gh issue view`).
5. Create the branch: `git switch -c story/N-<short-slug>`.

## B. The rail

| Step | Do | Gate |
|---|---|---|
| 1. Requirements | `run phase Requirements`. Run **sr-req-fetch**. | `spec.md` exists. If it lists **Open questions** → **ASK** the user, add their answers to the issue as a comment (`gh issue comment`), re-run sr-req-fetch. |
| 2. Build | `run phase Build`. Read `## Lanes`. Run **sr-fe-dev** and **sr-be-dev** in parallel (only the lanes needed; mark the other `set <station> skipped 0 "not in this story"`, same for its test station). | Each dev's commands green. Commit. |
| 3. Isolated tests | `run phase "Isolated tests"`. Run **sr-ui-tests** (needs fe) and **sr-api-tests** (needs be) in parallel. | Tests green except documented `test.fail()` findings. Product bugs found → send to the dev of that lane once, then re-run that test agent. Commit. |
| 4. Review + scan | `run phase "Review + scan"`, round `k=1`. Run **sr-reviewer** (diff `main...HEAD`) and **sr-scan** in parallel. Save the reviewer's reply as `runs/issue-N/review-round1.md`. | Both reports exist. Update `findings <blocker> <major> <minor> 0`. |
| 5. Fix | `run phase Fix`. If both reports are clean → skip (`set fixer skipped 0 "nothing to fix"`). Else run **sr-fixer** with k, then re-run reviewer + scan as round k+1. **Max 2 rounds.** | Reviewer `APPROVE` and scan has 0 blocker/major. After 2 rounds still failing → **ASK** the user (list the open findings). Commit. |
| 6. CI/CD → QA | `run phase "CI/CD"`, `set cicd running`. Push the branch, open a PR: title `<type>: <issue title>`, body lists ACs, reports and "Part of #N" (**not** "Closes" — the story closes at sign-off). Wait: `gh pr checks <pr> --watch`. | All required checks green (a failure → read the failing job, send it to the right agent, push again). Then **ASK**: "PR #X is green. Merge and deploy to QA?" On yes: `gh pr merge <pr> --squash --delete-branch`, `git switch main && git pull`. Watch the deploy: `gh run watch $(gh run list --branch main --workflow frontend.yml -L1 --json databaseId -q '.[0].databaseId')` (and `backend.yml` if backend changed). `set cicd done`. |
| 7a. Smoke | `run phase QA`. Read the `Smoke test (QA environment)` job result from that frontend run (`gh run view <id> --json jobs`). | Smoke passed → `set smoke done`. Failed → `set smoke failed`, stop and report: the deploy is broken. |
| 7b. Manual QA | Run **sr-manual-qa** with the QA URL. | No open blocker/major. Otherwise → triage (section C, step 1). |
| 8. Sign-off | `run phase "Sign-off"`, `set signoff waiting 0 "your decision"`. **ASK** the user to approve. | See section C. |

## C. Triage and sign-off

1. **Triage** (when Manual QA logged defects): show the defects table. **ASK** which to fix now (recommend: all blocker/major; minor/low to backlog unless cheap). For each defect: `gh issue create` with label `bug` (plus `backlog` if deferred), steps, expected/actual, the evidence path, "Found in QA for #N". Then run the **defect loop** (section D) for the fix-now issues, and come back to step 8.
2. **Approve** → comment a summary on every story issue (`gh issue comment`: what was built, test counts, review/scan findings fixed, QA result, backlog items) and close it (`gh issue close <n> --reason completed`). `set signoff done 100 "approved"`, `run phase Done`, `end`.
3. **Not approved** → ask what's missing. A change to the requirement is a new or edited issue and goes back to step 1; a defect goes to triage.

## D. Defect loop (`/storyrail fix <bug issues>`, or from triage)

Shorter rail; only what the bug touches.

1. `start "<bug issues>" "Defect loop: <titles>"`, branch `fix/<first>-<slug>`. Set `req-fetch skipped 0 "bug ticket is the requirement"`.
2. Decide the lane(s) from the bug. Run only that dev (`sr-fe-dev` / `sr-be-dev`) with the bug issue(s) as input; skip the other lane and its tests.
3. Run that lane's test agent to add a **regression test that fails on the old code** (tag `@BUG-<n>`).
4. Review + scan **on the diff only**, then fixer if needed (max 2 rounds).
5. PR with `Fixes #<bug>`; checks; **ASK** before merge; deploy; smoke.
6. **sr-manual-qa re-test**: each defect's steps plus a quick regression around it. Write `runs/issue-<first>/qa-retest.md`. Verified → comment "Verified on QA" on each bug. Not fixed → reopen it and **ASK** how to proceed.
7. Return to the story's sign-off (section C) if this loop came from triage.

## Finish

End every run with a short summary: what was built, PR link(s), test totals, findings fixed, QA result, backlog issues created, and what the user needs to do next (if anything).
