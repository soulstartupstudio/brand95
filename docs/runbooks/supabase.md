# Runbook: Supabase as the database

Brand95 OS uses PostgreSQL, and Supabase is hosted Postgres — so it plugs in
with connection strings only; no code changes.

## Current state

The Supabase project **Brand95** (`jpkkhkxutcezdnnjgbox`, eu-central-1) has
been provisioned with:

- The full Brand95 OS schema (applied as Supabase migration `brand95_init`,
  identical to `packages/database/prisma/migrations/20260726180631_init`).
- Prisma's `_prisma_migrations` bookkeeping, so `prisma migrate deploy` /
  `migrate dev` recognize the schema as up to date.
- The demo seed: Camera95 (Stage 1, dual route, evidence + agent runs),
  Crossbody (pending gate approval), Standard Dental (parked), Hold.

## Connecting the app

1. In the Supabase dashboard open **Connect → ORMs → Prisma**.
2. Put the two URLs in `.env` at the repo root:
   - `DATABASE_URL` — the *Transaction pooler* URL (port 6543), with
     `?pgbouncer=true` appended.
   - `DIRECT_URL` — the *Direct connection* URL (port 5432). Prisma uses this
     for migrations; the app itself uses the pooled URL.
3. `pnpm dev` — the app now reads and writes your Supabase project.
   (`pnpm db:seed` is a no-op there: the workspace already exists and the
   seed is idempotent.)

## Notes and guardrails

- Keep `TEST_DATABASE_URL` pointed at a **local disposable database** — the
  test suite empties it on every run. Never point it at Supabase.
- New migrations: `pnpm db:migrate` (uses `DIRECT_URL`). They apply to
  whichever database `.env` points at — check before running.
- Row Level Security is not enabled on these tables; access currently goes
  through the app server only. When Milestone 5 adds hosted auth, revisit
  RLS if anything ever talks to Supabase from the client side.
- Backups, logs, and a table editor are available in the Supabase dashboard.
