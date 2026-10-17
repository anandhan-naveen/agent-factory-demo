# Reporting to the live dashboard (all agents)

The orchestrator owns a live dashboard. Each agent reports **only its own station**.

- Load the tool once: `ToolSearch` with query `select:ArtifactData`.
- URL: `https://claude.ai/artifact/5DTRKpkrE2NjAwwcR6rKqP`
- Your document: collection `agents`, doc_id = your station id (given in your brief).
- Every write needs the current version: `get` the doc first, then `update` with `if_version` set to that version.
  Each `update` result returns the new version, so use that for the next write. Don't re-read.
- Fields: `status` (`running` | `done` | `ci` | `failed` | `blocked`), `progress` (0–100), `note` (≤ 60 chars, what you're doing or what you produced).
- Report at about 4–6 milestones. Never write any other document or collection.
- When finished: `status: "done"`, `progress: 100`, and a note with the headline result (e.g. "42 tests · 91% cov").
  Use `status: "ci"` only if your output can only be verified in GitHub Actions.
