# Approval framework

Every approval request carries: proposal · why now · evidence · exposure (cost, reversibility) · alternatives · recommendation · risk level. The founder sees them in the dashboard inbox or `jarvis approvals`, and decides: approve, reject, request changes (with a note).

| Level | Meaning | Examples | Who may proceed |
|---|---|---|---|
| 0 | Autonomous internal work | research, drafts, analysis, internal tasks, notes | agents, no approval |
| 1 | Batch approval | an outreach batch, scheduled content, bulk CRM changes | founder approves the batch once |
| 2 | Single-action approval | a one-off external email outside a sequence, price change, supplier commitment, paid campaign, spend | founder approves each |
| 3 | Founder-only | stage-gate advances, new unit / new brand investment, production spend above threshold, legal claims, kill/park, credentials | founder only, explicitly |

Mechanics:

- `jarvis request <ref> --kind .. --risk <0-3> …` creates a request. `jarvis outreach batch <ref>` creates a level-1 request bundling drafts.
- Approving an outreach batch flips its drafts to `approved`. `jarvis outreach sent <id>` only works on approved messages and auto-marks the batch `executed` when the last one is sent.
- Other kinds are marked done with `jarvis executed <id>`.
- Rejected or changes_requested leaves drafts as drafts; the writer revises and requests again.
- Stage-gate approvals: the gate must be complete; `jarvis advance <ref>` refuses otherwise (`--force` is logged).
