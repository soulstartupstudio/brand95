---
name: execute
description: Execute approved work. Finds approvals in status "approved", routes each to the right agent (research, outreach-sender, concept-validator, writer, finance, ops), logs the run, marks the approval executed, and proposes the next step.
---

Execute approved steps for `$ARGUMENTS` (unit ref or empty for all).

1. `npm run jarvis -- approvals --all --json` → keep `status === "approved"` (filter by unit if given).
2. For each, pick the agent from the proposal text / `kind`:
   - `outreach_batch` / `outreach_message` → `outreach-sender`
   - research or memo work → `research` or `writer`
   - experiment design or gate evidence → `concept-validator`
   - stage_gate → `npm run jarvis -- advance <ref>` (only if the gate is complete; otherwise report why not)
   - finance / ops reviews → `finance` / `ops`
   - anything else → do it yourself with the CLI, or ask.
3. Wrap every run: `npm run jarvis -- agent start <agent> <ref> "<objective>"` … `npm run jarvis -- agent finish <id> completed "<summary>"`.
4. Mark done: outreach is auto-executed when the last message is marked sent (`jarvis outreach sent <id>`); for every other kind run `npm run jarvis -- executed <approval-id> --note "<what was produced>"`.
5. Reply with what was executed, what was produced (note ids, lead ids, experiment ids) and **one** proposed next step per unit (as a new approval request). Stop for review.
