# Architecture

## Principles

- **One system, many companies.** Companies and units are data, not code. Adding a brand, a venture or a department is one CLI command.
- **State is the truth.** SQLite (`data/jarvis.db`) holds every entity and an append-only event log. Agents read and write through the CLI; conversation memory is never authoritative.
- **Draft → approve → execute.** External or irreversible actions are represented as approval requests. Execution reads the approval status; the CLI refuses to record a send for an unapproved message.
- **Deterministic core, judgment on top.** `src/engine/next.ts` computes ranked actions from state alone (testable, explainable). The `cofounder` agent adds judgment and writes proposals; it never bypasses the engine's warnings.
- **No vendor lock.** Integrations happen through Claude connectors used by agents (Gmail, Moneybird, Airtable, Notion, Shopify, Calendar, Drive). The domain model never references a vendor id except `outreach.external_id`.
- **Chat runtime.** `src/server/chat.ts` runs a manual streaming tool loop on the Anthropic SDK (`client.beta.messages.stream`): stable system prompt with a cache breakpoint, volatile state snapshot as a second system block, strict JSON-schema tools with eager input streaming and server-side plus local validation, at most 8 tool iterations, history persisted per session in `chat_messages`. Model/effort/fast-mode from env (`JARVIS_MODEL`, `JARVIS_EFFORT`, `JARVIS_FAST`). Events stream to the browser as SSE (`POST /api/chat`).
- **One runtime dependency** (`@anthropic-ai/sdk`). Node ≥ 22.18: `node:sqlite`, `node:http`, `node:test`, native TypeScript type-stripping. Install is `npm install` for `tsc` only.

## Layers

```
.claude/skills  (slash commands)  ──►  .claude/agents (roles)  ──►  jarvis CLI  ──►  services  ──►  SQLite
web/ dashboard  ──────────────────────────────────────────────────►  /api (same services)
```

- `src/services/portfolio.ts` — companies, units, gate evidence, stage advancing, metrics.
- `src/services/work.ts` — tasks, initiatives, decisions, notes, experiments, agent runs.
- `src/services/approvals.ts` — approval requests, decisions, execution marking, side effects (approving an outreach batch flips drafts to approved).
- `src/services/pipeline.ts` — leads, outreach drafts, batch approvals, send/reply recording.
- `src/engine/next.ts` — next-step engine (per unit and portfolio). `src/engine/brief.ts` — markdown founder brief. `src/engine/cockpit.ts` — company levels, goal tracking (linear expectation vs progress), focus, drift. `src/services/goals.ts` — goals CRUD and on-track math.
- `src/server/index.ts` — static dashboard + JSON API. `src/cli.ts` — command dispatcher.

## Data model

| Table | Purpose |
|---|---|
| companies | Custom95, Brand95, SSS, Student95, PortaPay. `north_star` text. |
| units | department / venture / brand / concept. `blueprint` key, `stage` (validation units), `status` active/parked/killed/graduated. |
| gate_evidence | per unit × stage × criterion: open / met / waived + evidence text. |
| initiatives | the ≤3 things a unit is pushing this month. |
| tasks | open/doing/blocked/done/dropped, priority 1–3, owner (`founder`, `agent:<name>`, person), due. |
| decisions | open questions with options; decision + rationale when decided. |
| approvals | kind, proposal, why_now, evidence, exposure, alternatives, recommendation, risk_level 0–3, payload JSON, status pending/approved/rejected/changes_requested/executed. |
| leads | B2B accounts with contact, fit score, status funnel, research note, angle, next_action_at. |
| outreach | per lead messages: draft/approved/sent/replied; `approval_id` links to the batch. |
| experiments | hypothesis, method, metric, target, result, learning, status. |
| metrics | KPI value per unit × key × period (upsert). |
| notes | research, memos, feedback, briefs. |
| agent_runs | who ran what, when, with which summary/outputs. |
| goals | measurable North Stars per company: target, baseline, current, deadline, horizon 12m/36m, optional link to a unit KPI. |
| chat_messages | persisted chat turns per session (content blocks as JSON). |
| events | append-only audit log for every mutation. |

Ids are time-sortable 18-char strings; the last 6 characters are unique enough to use as short refs in the CLI and dashboard (`byRef` resolves them and errors on ambiguity).

## Blueprints

`blueprints/*.json`, loaded by `src/domain/blueprints.ts`.

- `kind: "department"` — `kpis` (key, label, direction, target), `cadence`, `health_checks`, `playbooks`.
- `kind: "validation"` — ordered `stages`, each with `purpose`, `outputs`, `criteria` (key, label, optional numeric target); plus `kill_rules`.

The Brand95 Blueprint (`brand-blueprint.json`) is the condensed, machine-readable version of the original spec in `docs/legacy/brand95-os-skill.md`.

## Security and safety

- Dashboard binds to `127.0.0.1` by default. With `JARVIS_PASSWORD` set it binds `0.0.0.0` behind a login page (`src/server/auth.ts`): stateless HMAC session cookie, HttpOnly, SameSite=Lax, Secure behind HTTPS, 5 attempts/minute/IP, Bearer token for scripts. The server refuses a public bind without a password. Deployment: `Dockerfile`, `fly.toml`, `docs/deploy.md`.
- No secrets in the database or repo. Connectors are configured in Claude, not here.
- Every mutation writes an event with actor (`JARVIS_ACTOR`/`JARVIS_FOUNDER` env, default `founder`; agents set `agent:<name>`).
- `advance --force` is allowed but logged with `forced: true`.

## Extending

- New department type: add `blueprints/dept-<x>.json`.
- New validation track: add a `kind: "validation"` blueprint; the engine, gate view and CLI pick it up automatically.
- New agent: add `.claude/agents/<name>.md` and a skill that invokes it; use `jarvis agent start/finish` and store outputs as notes.
- Programmatic runtime: the CLI and `/api` are the surface a scheduled worker would call; see the roadmap in README.
