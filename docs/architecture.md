# Brand95 OS — Architecture

## Overview

Brand95 OS is a modular TypeScript monorepo (pnpm workspaces). The durable
source of truth is PostgreSQL. The web application is Next.js (App Router)
with React Server Components and Server Actions.

```
┌─────────────────────────────────────────────────────┐
│ apps/web (Next.js)                                  │
│  Portfolio dashboard · Brand dashboard · Blueprint  │
│  Create Brand wizard · Approval inbox · Activity    │
│  Server Actions ──► workflows in lib/               │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────┐   ┌──────────────────┐
│ packages/domain             │   │ packages/database │
│  Blueprint stage machine    │   │  Prisma schema    │
│  Gate criteria definitions  │◄──│  Migrations       │
│  Approval level policy      │   │  Seed data        │
│  Handoff/result schemas     │   │  Prisma client    │
└─────────────────────────────┘   └────────┬─────────┘
                                           │
                                    PostgreSQL 16
```

## Packages

### `packages/domain` — pure domain logic

No I/O, no framework dependencies. Contains:

- **Blueprint definitions** (`blueprint.ts`): the 11 stages (Intake → Systemize
  and Scale) with required outputs, gate criteria, and evidence targets.
- **Stage machine** (`stage-machine.ts`): the only legal transition is to the
  next stage, and only when the current gate has a founder-level approval
  decision. Gate readiness is computed from recorded criteria status —
  evidence, not document existence.
- **Approval policy** (`approvals.ts`): Levels 0–3 with the action catalogue
  that maps proposed action types to required levels.
- **Agent contracts** (`agents.ts`, `handoff.ts`): the ten specialist agent
  definitions plus zod schemas for the standard handoff and result payloads.

Everything is exported as data + pure functions so the same rules run in the
web app, workers, tests, and future agent runtimes.

### `packages/database` — persistence

Prisma schema (`prisma/schema.prisma`), migrations, a singleton client, the
transactional workflow layer (`src/workflows/` — New Brand Intake, gate
evidence/criteria, approval requests and decisions, stage advance), and a
seed script. Entities implemented for the Blueprint MVP: workspace/user/brand
identity, brand stages with gates/criteria/evidence, workstreams, tasks,
approval requests + decisions, decision log, risks, artifacts, agent runs, and
the immutable event log. Further spec entities (supply chain, commerce, retail
CRM, marketing, finance) are added milestone by milestone — vertical slices,
not unused scaffold.

Conventions: UUID primary keys, `createdAt`/`updatedAt` audit timestamps,
soft-deletion via `archivedAt` where appropriate, workspace ownership on every
aggregate root.

### `packages/agents` — the agent runtime

Claude-powered specialist agents with a zero-credential mock mode. Contains
the LLM access layer (structured JSON outputs validated by zod, refusal
handling), per-agent system prompts, and the first two agent workflows:

- **Stage engine** (`workflows/engine.ts`): every blueprint stage from
  Discover (1) through Systemize & Scale (10) has a plan — which specialists
  run in parallel, what each delivers, and which gate criteria the deliverable
  evidences. The CEO Orchestrator consolidates the results into one stage
  document (Opportunity Memo, Validation Report, Brand Book Draft, Production
  Approval Pack, Launch Readiness Report, …) with a proceed/revise/park/reject
  recommendation. Idempotent against double-runs; re-runs create new artifact
  versions, never duplicates. All ten specialist agents are wired in.
- **Retail outreach** (`workflows/outreach.ts`): drafts personalized emails
  behind a Level 1 batch approval; execution goes through the email adapter
  with an idempotency key per message so retries can never double-send.
- **Weekly CEO Review** (`workflows/ceo-review.ts`): portfolio-wide founder
  briefing — biggest bottleneck per brand, max three priorities each, overdue
  approvals — stored as a versioned workspace-level artifact.

Without `ANTHROPIC_API_KEY`, both run in mock mode with clearly labeled
placeholder output, so the full flow stays demoable and testable.

### `apps/web` — the application

Next.js App Router. Reads happen in server components straight through Prisma;
writes go through Server Actions (`src/lib/actions.ts`) that call the workflow
functions in `packages/database/src/workflows/`. Each workflow writes its own
`Event` rows and enforces approval requirements — the UI cannot bypass them
because enforcement lives in the workflow layer, not the form.

## Coordination layers (per spec §4)

1. **Shared database** — current state (Postgres).
2. **Event log** — `Event` table, append-only.
3. **Task queue** — `Task` table with status/dependencies; a durable job runner
   (worker app) is Milestone 6.
4. **Artifact registry** — `Artifact` + `ArtifactVersion`.
5. **Decision log** — `Decision`, `ApprovalRequest`, `ApprovalDecision`.
6. **Agent handoff object** — zod-validated payloads stored on `AgentRun`.

## Security posture

- Secrets only via environment variables (`.env`, never committed).
- Approval enforcement in the workflow layer; destructive actions are
  founder-only (Level 3).
- Append-only event log for auditability.
- Auth is single-workspace/founder for the MVP; hosted auth provider slot is
  reserved for Milestone 5+ (see `docs/integrations.md`).

## Local development

See AGENTS.md. Postgres 16 locally; `pnpm db:migrate && pnpm db:seed && pnpm dev`.
