# Agents

All agents run inside Claude Code in this repo (`.claude/agents/*.md`), invoked by slash commands (`.claude/skills/*/SKILL.md`). They read and write state only through the `jarvis` CLI, log every run (`jarvis agent start/finish`), store outputs as notes, and never act externally without an approval.

| Agent | Mission | Writes | External | Invoked by |
|---|---|---|---|---|
| cofounder | Pick the single highest-leverage next step per unit; push back on drift | approval requests (`next_step`) | none | `/next`, `/weekly` |
| lead-researcher | Find and score B2B accounts with verified contacts and an angle | leads, research notes | web reading only | `/research-leads` |
| outreach-writer | Personalized drafts in the founder's voice; batch approval | outreach drafts, batch approval | none | `/outreach` |
| outreach-sender | Send approved drafts via Gmail; record sends | outreach status, external ids | Gmail send/draft | `/send-approved` |
| research | Source-backed stage research; proceed/revise/park/reject memo | research notes | web reading only | `/research` |
| concept-validator | Cheapest experiment for the open gate criterion; assets | experiments, memos, spend approvals | none | `/validate` |
| writer | One-pagers, memos, SOPs, proposals, landing copy | memo notes | none | `/write` |
| finance | KPIs from Moneybird or founder input; cash/margin risk | metrics, tasks, approvals | Moneybird read | `/finance-review` |
| ops | Weekly operating review; SOP gaps; owned tasks | tasks, metrics, memos | none | `/ops-review` |

## Contracts

- **Start/finish**: `jarvis agent start <name> <ref> "<objective>"` → `jarvis agent finish <id> completed|failed "<summary>"`.
- **Outputs** go to `jarvis note <ref> "<title>" --kind research|memo|feedback --body ...` so the founder and other agents can read them.
- **Handoffs** happen through state: a researcher stores `research` and `angle` on the lead; the writer reads them. No agent-to-agent chat is authoritative.
- **Never**: approve, send unapproved, fabricate sources, mark gate criteria without evidence, advance stages.

## Adding an agent

1. Create `.claude/agents/<name>.md` with frontmatter (`name`, `description`, `tools`) and a procedure that starts with reading state via the CLI and ends with `agent finish`.
2. Create `.claude/skills/<command>/SKILL.md` that invokes it and specifies the reply shape.
3. If the agent needs a new action type, add it to the engine's `Action.type` union and to `docs/approvals.md` if it touches the outside world.
