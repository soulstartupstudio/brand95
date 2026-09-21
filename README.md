# JARVIS — founder command center

One operating system for all of Dex's companies: **Custom95** (departments: sales, operations, finance, marketing, plus new offers), **Brand95** (owned brands on the Brand95 Blueprint), **Soul Startup Studio** (venture validation), **Student95** and **PortaPay**.

It does five things:

0. **Talks** — a streaming chat with Jarvis in the dashboard (and `jarvis chat` in the terminal) that reads the live state and can act on it through tools, inside the same approval gates.
1. **Shows state** — every company, every unit, its stage, its gate, its KPIs, its pipeline, on one screen.
2. **Decides what's next** — a deterministic next-step engine plus a Claude co-founder that proposes one step per unit and waits for your review.
3. **Gates execution** — nothing external (outreach, spend, stage advances, publishing) happens without an approval in the inbox.
4. **Runs agents** — lead research, outreach writing/sending, validation research, experiment design, writing, finance and ops reviews, all inside Claude Code, all logged.

One runtime dependency (`@anthropic-ai/sdk`, for chat). Node ≥ 22.18 (built-in SQLite and TypeScript). Local-first: one SQLite file.

## Quick start

```bash
npm install                 # dev tooling only (typescript)
npm run init                # creates data/jarvis.db
npm run seed                # loads the real portfolio structure (add --demo for sample data)
export ANTHROPIC_API_KEY=sk-ant-…   # only needed for chat
npm run serve               # dashboard at http://127.0.0.1:4795 (Cockpit is the home view; press / to talk)
npm run jarvis -- status    # or: ./bin/jarvis status
npm run jarvis -- cockpit   # levels, goals on-track, focus, drift
npm run jarvis -- chat "Where am I off track?"
```

## Cockpit

The home view answers four questions:

| Question | How it is computed |
|---|---|
| Where am I? | Every company gets a **level 0–5** (Idea → Validating → Building → Operating → Scaling → Systemized): validation units by stage and gate progress, departments by KPI coverage and KPIs on target. |
| Am I on track? | Every North Star is a **goal** with a target, deadline and current value. Progress is compared with the linear expectation for today: ahead / on track / behind / off track / overdue. Goals linked to a KPI (`metric_key`) update themselves when the metric is recorded. The portfolio score is the share of measured goals on track. |
| Where does focus go? | The next-step engine's priority-1 actions per company, plus the heat dot per unit. |
| Am I still aligned? | **Drift** checks: companies without goals, initiatives not linked to a goal, active units with no goal above them, goals with no data. |

Seeded goals mirror the North Stars (Custom95 €3M / 12% margin / 40% recurring / ≤2 founder ops hours; Brand95 first launch and two €500k brands; SSS three validated decisions and two startups with traction; Student95 25 associations; PortaPay 5 paying pilots). Current values start empty: record them from the cockpit, with `jarvis goal-progress custom95/revenue 1450000`, or just tell Jarvis in chat.

## Talking to Jarvis

The chat drawer (button bottom-right, or press `/`) streams the answer token by token over Server-Sent Events. It sees the live cockpit state in its system prompt and has tools for tasks, initiatives, leads, drafts, notes, gate evidence, experiments, KPIs, goal progress, approval requests and (only when you say so) approval decisions. It never sends email or spends money: those still land in the approvals inbox.

Speed: defaults to `claude-opus-5` at `low` effort with a cached system prompt, which gives first tokens in well under a second on a normal connection. The **deep** toggle switches to `high` effort for real thinking. `JARVIS_FAST=1` enables Anthropic fast mode (Opus 5, ~2.5× output speed, premium price). `JARVIS_MODEL=claude-haiku-4-5` is the cheapest option. Conversations persist per browser session in the database; `clear` starts fresh.

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
| Cockpit | `cockpit`, `goals [company]`, `goal <company> <key> "label" --target n --deadline d [--horizon 36m --unit ref --metric key --baseline n --unit-label EUR --down]`, `goal-progress <company/key> <value>`, `chat "message" [--deep]` |
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

Agents live in `.claude/agents/` and are invoked by the skills in `.claude/skills/` (slash commands). See `docs/agents.md` for the roster and contracts. Sixteen MIT-licensed craft skills (cold email, prospecting, lead scoring, pricing, positioning, competitor intel, customer research, startup validation, proposals, board updates) are vendored from public collections with attribution; see `docs/skills-catalog.md`. Integrations (Gmail, Moneybird, Airtable, Notion, Shopify, Calendar, Drive) are used through Claude's connectors by the agents; the core never depends on any vendor.

## Repo layout

```
bin/jarvis              CLI entry
src/cli.ts              command dispatcher
src/db/                 schema.sql + sqlite helpers
src/domain/             types, blueprint loader
src/services/           portfolio (companies, units, gates, metrics) · work (tasks, initiatives, decisions, notes, experiments, agent runs) · approvals · pipeline (leads, outreach)
src/engine/             next-step engine · founder brief · cockpit (levels, goals on-track, drift)
src/server/chat.ts      streaming chat with tools (Anthropic SDK, SSE)
src/server/             dashboard + JSON API
src/seed.ts             real portfolio structure (+ --demo sample data)
web/                    dashboard (vanilla JS)
blueprints/             dept-sales, dept-operations, dept-finance, dept-marketing, venture-validation, offer-validation, brand-blueprint
.claude/agents          cofounder, lead-researcher, outreach-writer, outreach-sender, research, concept-validator, writer, finance, ops
.claude/skills          /next /review /execute /brief /weekly /research-leads /outreach /send-approved /validate /research /write /finance-review /ops-review /new-unit
docs/                   architecture, operating model, approvals, agents, legacy Brand95 spec
tests/                  node:test suite
```

## Hosting (phone access, password)

One container with a persistent volume. Set `JARVIS_PASSWORD` and the server binds publicly with a login page, HttpOnly session cookie, login rate limiting, and `Authorization: Bearer <password>` for scripts. Fly.io is the recommended host (about €3/month); Railway and any Docker host work the same way. Vercel does not fit: no persistent disk for the SQLite file. Steps in `docs/deploy.md`.

```bash
fly launch --copy-config --no-deploy && fly volumes create jarvis_data --size 1 --region ams
fly secrets set JARVIS_PASSWORD='…' ANTHROPIC_API_KEY='…' && fly deploy
```

## Development

```bash
npm test                # node:test
npm run typecheck       # tsc --noEmit
```

## Roadmap (not built yet, deliberately)

- Scheduled agent runs outside Claude Code (the chat runtime is the seed: same tools, add a scheduler).
- Two-way sync adapters (Airtable/Notion) once a second operator needs a non-CLI interface.
- Multi-user auth (today: one founder password, or an identity proxy in front).
