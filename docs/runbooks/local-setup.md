# Runbook: local setup

1. Prerequisites: Node ≥ 20, pnpm, PostgreSQL 16.
2. Create the databases:
   ```bash
   createuser brand95 --createdb          # or via psql: CREATE USER brand95 ... ;
   createdb -O brand95 brand95_dev
   createdb -O brand95 brand95_test
   ```
3. Configure:
   ```bash
   cp .env.example .env                   # adjust DATABASE_URL/DIRECT_URL if needed
   ```
   To use Supabase instead of local Postgres for the app database, see
   [supabase.md](./supabase.md) — only steps 1–2 (databases) change; the test
   database stays local either way.
4. Install, migrate, seed, run:
   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   pnpm dev                               # http://localhost:3000
   ```
5. Quality gates:
   ```bash
   pnpm typecheck && pnpm test && pnpm build
   ```

Troubleshooting:
- `P1001 can't reach database` — Postgres isn't running (`service postgresql start`).
- Migration drift on a dev machine — `pnpm --filter @brand95/database exec prisma migrate reset` (dev only; destructive).
