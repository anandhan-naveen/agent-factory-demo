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
- **Shell:** your Bash working directory persists between calls. Always run from the repo root and use subshells for other folders, e.g. `(cd frontend && npm run lint)`. Never leave a `cd` behind.
- **Long waits** (CI, deploys) must not block a single Bash call for more than a few minutes: poll every ~60 s with short commands (see B.6), or run the wait in the background.
- Status: always through `node scripts/storyrail-status.mjs …`. You own the stations `req-writer`, `cicd`, `smoke`, `signoff`, and the run fields (`run phase …`, `run summary …`). Agents own their stations.
- **Parallel stages**: launch both subagents **in the same message** so they run at the same time.
- Give each subagent everything it needs in its prompt: `N`, the run folder, round number `k`, the QA URL and expected bundle, and the earlier agent's reply when it matters (e.g. new test ids for UI automation).
- After each stage, read the agent's reply and check its gate yourself (run the command if in doubt). A stage that misses its gate is **not done**: send it back once with the exact failure; if it fails again, stop and ask the user.
- Commit after every stage on the run branch (`feat:`, `test:`, `fix:`, `chore:`), never on `main`.
- One short line to the user per stage. Ask the user only at the gates marked **ASK**.

**The quality gate (same rule everywhere):** reviewer verdict `APPROVE` (0 blocker, 0 major) **and** scan with 0 blocker/major findings, 0 lint warnings, 0 secrets, 0 high/critical vulnerabilities. The fixer still fixes minors, but minors alone never block.

## A. Before the agents start

1. **Prerequisites:** `gh auth status`; `git status --porcelain` must be empty (if not, list the files and **ASK** whether to commit, stash or stop); `git switch main && git pull --ff-only`.
2. Start the dashboard if it isn't running: `node scripts/storyrail-dashboard.mjs` **in the background** (it exits by itself if already running). Tell the user to open http://localhost:4800.
3. Read the issue: `gh issue view <n> --json number,title,author,url`. Title for display = the issue title without a leading `[Story] ` / `[Bug] ` tag.
4. `node scripts/storyrail-status.mjs start "<issues comma-separated>" "<title>"`, then `run repo <owner/repo>` (from `gh repo view --json nameWithOwner -q .nameWithOwner`).
5. `set req-writer done 100 "issue #N by <author.login>"`.
6. Branch: `git switch -c story/N-<slug>` where slug = title lower-cased, only `[a-z0-9-]`, max 40 chars.

## B. The rail

**1. Requirements.** `run phase Requirements`. Run **sr-req-fetch**.
Gate: `runs/issue-N/spec.md` exists. If it lists **Open questions** → **ASK** the user, post their answers on the issue (`gh issue comment <n> --body …`), re-run sr-req-fetch. Commit.

**2. Build.** `run phase Build`. Read `## Lanes`. Run **sr-fe-dev** and **sr-be-dev** in parallel (only the lanes needed; mark an unneeded lane and its test station `skipped 0 "not in this story"`).
Gate: each dev's commands green. Commit.

**3. Isolated tests.** `run phase "Isolated tests"`. Run **sr-ui-tests** (if fe) and **sr-api-tests** (if be) in parallel.
Gate: green except documented `test.fail()` findings. Product bugs → send to that lane's dev once, then re-run the test agent. Commit.

**4. Review + scan, round k (start k=1).** `run phase "Review + scan"`. Run **sr-reviewer** (diff `main...HEAD`) and **sr-scan** (round k) in parallel. **Every round**, save the reviewer's reply as `runs/issue-N/review-round<k>.md`.
Then `findings <blocker> <major> <minor> <fixed-so-far>` (both reports combined).

**5. Fix.** `run phase Fix`. If both reports are already clean (no findings at all) → `set fixer skipped 0 "nothing to fix"`. Otherwise run **sr-fixer** with k, update `findings … <fixed>`, commit, and go back to step 4 with k+1.
Gate: the quality gate above. Max 2 fix rounds; still failing → **ASK** the user with the open findings.

**6. CI/CD → QA.** `run phase "CI/CD"`, `set cicd running 10 "opening PR"`.
- `git push -u origin HEAD`. `gh pr create --title "<type>: <title>" --body "<ACs, links to runs/issue-N reports>\n\nPart of #N"` (**not** "Closes": the story closes at sign-off).
- Wait for checks to appear: poll `gh pr checks <pr>` every 10 s (max 2 min) until it lists checks. Then poll every 60 s until none is pending (`gh pr checks <pr> --json name,state,bucket`).
- A failed check → `gh run view <run-id> --log-failed | tail -n 80`, send the failure to the right agent, commit, push, wait again.
- Green → **ASK**: "PR #X is green. Merge and deploy to QA?" On yes: `gh pr merge <pr> --squash --delete-branch`, `git switch main && git pull --ff-only`.
- Find the deploy runs for **this** merge: `sha=$(gh pr view <pr> --json mergeCommit -q .mergeCommit.oid)`; poll `gh run list --commit $sha --json databaseId,workflowName,status,conclusion` until the expected workflows appear (frontend.yml only runs if `frontend/**` or `tests/ui/**` changed; backend.yml only if `backend/**`, `tests/api/**` or `docs/api/**` changed). Poll each until `completed`.
- Any run not `success` → `set cicd failed`, show the failing job, stop and **ASK**. All success → `set cicd done 100 "merged #<pr> · deployed"`.

**7a. Smoke.** `run phase QA`.
- Frontend deployed: read the `Smoke test (QA environment)` job of that frontend run (`gh run view <id> --json jobs`), and get the served bundle name from its log line `Smoke test passed: … assets/<name>.js` (`gh run view <id> --log | grep "Smoke test passed"`).
- Backend only: the smoke gate is the `deploy-render` job's "Smoke test GET /api/books" step; if that job was skipped (no Render configured), say so and mark smoke `skipped 0 "no backend QA env"`.
- Passed → `set smoke done`. Failed → `set smoke failed`, stop and report: the deploy is broken.

**7b. Manual QA.** Before starting, check what QA can see: the Pages QA site runs in **demo mode** (in-browser mock API) unless the repo variable `API_BASE_URL` points at a deployed backend. Ask the user once per session if you can't tell. If QA is demo-only, tell sr-manual-qa to test the frontend on the QA URL and to check backend ACs against `BACKEND_URL` with curl if one exists, else mark them "not testable in QA".
Run **sr-manual-qa** with the QA URL (https://anandhan-naveen.github.io/storyrail/) and the expected bundle name.
Gate: no open blocker/major. Otherwise → triage (C.1).

**8. Sign-off.** `run phase "Sign-off"`, `set signoff waiting 0 "your decision"`. **ASK** the user to approve. See C.

## C. Triage and sign-off

1. **Triage** (Manual QA logged defects): show the defects table. **ASK** which to fix now (recommend: all blocker/major; minor/low to backlog unless cheap). For each: `gh issue create --label bug [--label backlog] --title "[Bug] …" --body "<steps, expected, actual, evidence path>\n\nFound in QA for #N"`. Run the **defect loop** (D) for the fix-now issues *as part of this run*, then come back to step 8.
2. **Approve** →
   - Save QA records: `git switch -c chore/N-qa-records`, commit `runs/issue-N/`, push, `gh pr create … --body "QA records for #N"`, wait for checks, `gh pr merge --squash --delete-branch`, back to `main`.
   - Comment a summary on every story issue (what was built, PR links, test counts, findings fixed, QA result, backlog issues) and close it: `gh issue close <n> --reason completed`.
   - `set signoff done 100 "approved"`, `run phase Done`, `end`.
3. **Not approved** → ask what's missing. A requirement change is a new or edited issue and goes back to step 1; a defect goes to triage.

## D. Defect loop (`/storyrail fix <bug issues>`, or from triage)

Shorter rail; only what the bug touches.

1. Run **A.1** (prerequisites). Then:
   - Started standalone (`/storyrail fix …`): `start "<bugs>" "Defect loop: <title>"`, `run repo …`, B = first bug number, run folder `runs/issue-B/`.
   - Started from triage: **don't** call `start` (it would wipe the story). Use `loop <bugs>` (resets only the build-to-QA stations, keeps the run), run folder stays `runs/issue-N/` with a `bugs-<B>/` subfolder.
   - Write the bug spec yourself from `gh issue view <bug>`: `spec.md` with Issues, Lanes, the bug's steps/expected as ACs (`BUG-<n>`), and "Found in QA for #N". `set req-fetch skipped 0 "bug ticket is the requirement"`.
   - Branch `fix/<B>-<slug>`.
2. Run only the affected lane's dev with the bug spec; skip the other lane and its tests.
3. That lane's test agent adds a **regression test that fails on the old code** (tag `@BUG-<n>`).
4. Review + scan **on the diff only**, then fixer if needed (max 2 rounds, same quality gate).
5. PR with `Fixes #<bug>`, checks, **ASK** before merge, deploy, smoke (as B.6–7a).
6. **sr-manual-qa re-test**: each defect's steps plus a quick regression around it → `qa-retest.md`. Verified → comment "Verified on QA" on each bug (it's already closed by the PR). Not fixed → `gh issue reopen <bug>` and **ASK** how to proceed.
7. From triage: return to the story's sign-off (B.8).

## Finish

End every run with a short summary: what was built, PR link(s), test totals, findings fixed, QA result, backlog issues created, and anything the user needs to do next.
