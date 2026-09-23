# Connected apps

The command center never calls Moneybird, Airtable, Notion, Supabase, Gmail or Shopify itself. **Claude does**, through the connectors attached to your Claude account, and writes the result into the command center. This keeps credentials out of the repo and makes every import auditable (`jarvis events` shows `sync.imported` with counts).

```
Moneybird / Airtable / Supabase / Notion / Shopify
        │  read-only, via Claude connectors
        ▼
   sync agent  ──►  data/snapshots/YYYY-MM-DD.json  ──►  jarvis import   (local)
                                                      ──►  POST /api/import (hosted, Bearer password)
        ▼
   metrics · goal progress · leads · notes · tasks  ──►  cockpit, next-step engine, brief
```

## What is connected today (2026-09-21)

| App | What's there | Feeds |
|---|---|---|
| Moneybird | Custom95 B.V. administration (2020→) | revenue, gross/net margin, receivables → `custom95/finance`, goal `custom95/revenue`, `custom95/net_margin` |
| Airtable | Custom95 CRM, Custom95 SRM, People/HR | pipeline value, new leads, meetings → `custom95/sales`; supplier scores → `custom95/operations` |
| Supabase | `custom95-database`, `Custom95-HR`, `Brand95`, `PORTA` (+ inactive `porta`) | brand / venture evidence counts → gate criteria on `brand95/*`, `portapay/validation` |
| Notion | Custom95 workspace (offer, sales structure, hiring, onboarding) | memos on units, links as evidence |
| Gmail | dex@custom95.nl | outreach sending (approved only), reply detection |
| Shopify | brand stores when live | orders, customers, AOV → brand metrics |

## How to refresh

- In Claude Code: `/sync` (all) or `/sync moneybird`. Weekly is enough; `/weekly` calls it.
- Hosted instance: add `--to https://<app>.fly.dev`; the agent posts the snapshot with your password.
- On a schedule: create a Claude Routine that runs `/sync --to <url>` every Monday 07:00 with the Moneybird and Airtable connectors granted. The hosted app receives the numbers without anyone opening a laptop.

## Snapshot format

See `src/services/sync.ts` (`Snapshot`). Metrics upsert per unit/key/period; goals set `current`; leads dedupe on company name per unit; notes and tasks append. Errors are reported per item and never abort the rest.

## Direct database access (later)

If you want the app to read Supabase directly (for example live order counts on a brand page), add an adapter under `src/integrations/` that reads with a service key from the host environment and writes through the same `importSnapshot`. Do not put keys in the repo.
