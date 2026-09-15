# JARVIS — founder command center

One operating system for all of Dex's companies: **Custom95** (departments: sales, operations, finance, marketing, plus new offers), **Brand95** (owned brands on the Brand95 Blueprint), **Soul Startup Studio** (venture validation), **Student95** and **PortaPay**.

It does four things:

1. **Shows state** — every company, every unit, its stage, its gate, its KPIs, its pipeline, on one screen.
2. **Decides what's next** — a deterministic next-step engine plus a Claude co-founder that proposes one step per unit and waits for your review.
3. **Gates execution** — nothing external (outreach, spend, stage advances, publishing) happens without an approval in the inbox.
4. **Runs agents** — lead research, outreach writing/sending, validation research, experiment design, writing, finance and ops reviews, all inside Claude Code, all logged.

No runtime dependencies. Node ≥ 22.18 (built-in SQLite and TypeScript). Local-first: one SQLite file.

## Quick start

```bash
npm install                 # dev tooling only (typescript)
npm run init                # creates data/jarvis.db
npm run seed                # loads the real portfolio structure (add --demo for sample data)
npm run serve               # dashboard at http://127.0.0.1:4795
npm run jarvis -- status    # or: ./bin/jarvis status
```

Then, in Claude Code inside this repo:

```
/next                       # co-founder proposes the next step per unit → approvals inbox
/review                     # walk through what is waiting on you
/execute                    # run the approved steps through agents
/brief                      # founder brief with 3 priorities
/weekly                     # Monday CEO review
```

## How it is organized

```
company  ─┬─ unit (department)   e.g. custom95/sales        → dept-* blueprint: KPIs, cadence, health checks
          ├─ unit (concept)      e.g. custom95/brandshops   → offer-validation: 4 stages
          ├─ unit (brand)        e.g. brand95/camera95      → brand-blueprint: 11 stages (from the Brand95 spec)
          └─ unit (venture)      e.g. portapay/validation   → venture-validation: 7 stages
```

Each validation unit sits at one **stage** with **gate criteria**. Criteria are marked met with evidence; the stage advances only when the gate is complete (or with an explicit, logged `--force`). Every unit has initiatives (max 3), tasks, decisions, notes, experiments, metrics and an activity log. Sales units also have a lead pipeline and outreach.

### Approvals: the review loop

Agents and the co-founder never act externally. They write an **approval request** (proposal, why now, evidence, exposure, alternatives, recommendation, risk level 0–3). You approve, reject or request changes in the dashboard or with `jarvis approve <id>`. Only then does `/execute` run it. Outreach specifically: `draft → batch approval → approved → sent (Gmail) → replied`, and the CLI refuses to mark anything sent that was not approved.

### The next-step engine

`jarvis next` ranks actions per unit from state alone: pending approvals and open decisions first, then overdue/blocked work, then gate logic (no running experiment for an open criterion, gate complete but not advanced, two failed experiments → park), department health (KPIs off target, stale leads, empty outreach queue, approved-but-unsent emails, replies waiting), and focus (no initiative, too many initiatives). Portfolio rules add warnings: one brand in Build, one in Validate, at most two ventures past intake, and a founder-attention overload check. The `cofounder` agent adds judgment on top and turns it into approval requests.

## CLI reference

`npm run jarvis -- help` prints everything. The most used:

| Area | Commands |
|---|---|
| Portfolio | `status`, `next [ref]`, `brief [--out f.md]`, `companies`, `units [company]`, `unit <ref>`, `unit add …`, `unit park|activate|kill <ref>` |
| Approvals | `approvals [--all]`, `approve|reject|changes <id> [--note ..]`, `executed <id>`, `request <ref> --kind .. --title .. --proposal .. --risk 0-3` |
| Work | `tasks [ref]`, `task <ref> "title" [--due --p --owner]`, `done <id>`, `initiative <ref> "title" --objective ..`, `decision <ref> "q" --options "a|b"`, `decide <id> "choice" --why ..`, `note <ref> "title" --body .. --kind research|memo|feedback` |
| Validation | `gate <ref> [criterion met|waived|open --evidence ..]`, `advance <ref> [--force]`, `experiment <ref> "hypothesis" --method .. --metric .. --target ..`, `experiment-status <id> running|passed|failed`, `metric <ref> <key> <value> --period YYYY-MM` |
| Pipeline | `leads [ref] [--status s]`, `lead <ref> "Company" --segment --contact --email --fit --angle --research`, `lead-update <id> --status ..`, `draft <lead-id> --subject .. --body ..`, `outreach [ref]`, `outreach batch <ref>`, `outreach sent <id> --external-id ..`, `outreach replied <id>` |
| Agents | `agent start <name> <ref> "objective"`, `agent finish <id> completed "summary"`, `agents` |
| System | `serve [--port]`, `events`, `blueprints`, `export` |

Unit refs are `company/slug`. Ids can be abbreviated to their last 6 characters (as shown in the CLI and dashboard).

## Dashboard

`npm run serve` → sidebar with every company and unit (heat dot = urgency, badge = pending approvals), and views for Overview (do-today list, warnings, activity), Approvals inbox (approve / reject / request changes), Founder brief, Agents, per-company and per-unit pages with tabs: Next · Tasks · Validation or KPIs · Pipeline · Decisions · Notes · Approvals. The dashboard and the CLI use the same service layer; the JSON API is under `/api/*` (see `src/server/index.ts`).

## Agents and skills

Agents live in `.claude/agents/` and are invoked by the skills in `.claude/skills/` (slash commands). See `docs/agents.md` for the roster and contracts. Integrations (Gmail, Moneybird, Airtable, Notion, Shopify, Calendar, Drive) are used through Claude's connectors by the agents; the core never depends on any vendor.

## Repo layout

```
bin/jarvis              CLI entry
src/cli.ts              command dispatcher
src/db/                 schema.sql + sqlite helpers
src/domain/             types, blueprint loader
src/services/           portfolio (companies, units, gates, metrics) · work (tasks, initiatives, decisions, notes, experiments, agent runs) · approvals · pipeline (leads, outreach)
src/engine/             next-step engine · founder brief
src/server/             dashboard + JSON API
src/seed.ts             real portfolio structure (+ --demo sample data)
web/                    dashboard (vanilla JS)
blueprints/             dept-sales, dept-operations, dept-finance, dept-marketing, venture-validation, offer-validation, brand-blueprint
.claude/agents          cofounder, lead-researcher, outreach-writer, outreach-sender, research, concept-validator, writer, finance, ops
.claude/skills          /next /review /execute /brief /weekly /research-leads /outreach /send-approved /validate /research /write /finance-review /ops-review /new-unit
docs/                   architecture, operating model, approvals, agents, legacy Brand95 spec
tests/                  node:test suite
```

## Development

```bash
npm test                # node:test
npm run typecheck       # tsc --noEmit
```

## Roadmap (not built yet, deliberately)

- Programmatic agent runtime (Claude API) for scheduled runs outside Claude Code; the CLI/API surface is already what it would call.
- Two-way sync adapters (Airtable/Notion) once a second operator needs a non-CLI interface.
- Auth + hosted deployment; today the dashboard binds to localhost only.
