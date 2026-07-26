# Brand95 OS — Agent Instructions

Brand95 OS is an approval-gated, multi-brand operating system. One operating
system, many brands (Camera95, Crossbody, Standard Dental, Hold, and future
brands). The full product specification lives in [README.md](./README.md);
architecture notes live in [docs/](./docs).

## Repository layout

```
apps/web            Next.js application (dashboards, wizard, approvals)
packages/domain     Pure TypeScript domain logic — blueprint, gates, approvals
packages/database   Prisma schema, migrations, client, seed data
.codex/agents       Project-scoped specialist agent definitions (TOML)
docs/               Architecture, blueprint, data model, approvals, integrations
```

## Ground rules for any agent working in this repository

1. **PostgreSQL is the source of truth.** Airtable and other tools are
   integrations, never the durable domain model.
2. **Draft first, approve, then execute.** Nothing external (email, orders,
   publishing, spend) happens without an `ApprovalRequest` that has been
   decided by a human. Approval requirements must not be bypassable.
3. **Evidence before expansion.** Stage gates unlock on recorded evidence and
   an explicit founder decision, never because documents merely exist.
4. **Idempotent execution.** Retrying a workflow must not duplicate emails,
   records, orders, or tasks. Use `IdempotencyKey` records for external actions.
5. **Traceability.** Every meaningful state change writes an `Event` row:
   actor, inputs, timestamp, result.
6. **No secrets in code, prompts, logs, or database text fields.** Secrets come
   from environment variables only (see `.env.example`).
7. **No fake completion.** Mark work complete only after verifying the actual
   record, file, API response, test, or deployment.

## Development

```bash
pnpm install
cp .env.example .env          # then adjust DATABASE_URL if needed
pnpm db:migrate               # apply Prisma migrations
pnpm db:seed                  # seed workspace, founder, blueprint + demo brands
pnpm dev                      # start the web app on :3000
```

Quality gates for every increment (run before committing):

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Working style

- Implement vertically complete slices; keep the app runnable after each change.
- Real schemas, migrations, validation, tests, and error states — no pseudocode.
- For unavailable integrations, build a typed adapter with a mock implementation
  and exact configuration instructions.
- Log assumptions instead of blocking on minor ambiguity.
- Do not delegate overlapping writes to the same files when parallelizing.
