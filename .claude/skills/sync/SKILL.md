---
name: sync
description: Refresh the command center from the connected apps (Moneybird finance, Airtable CRM/SRM, Supabase, Notion, Shopify) into KPIs, goal progress, leads and notes. Usage: /sync [moneybird|airtable|supabase|notion|all] [--to <hosted url>].
---

Use the `sync` agent for `$ARGUMENTS` (default `all`). If `--to <url>` is given, the agent posts the snapshot to that hosted instance's `/api/import` with `JARVIS_PASSWORD`; otherwise it runs `jarvis import` locally.

Reply with: the headline numbers (value, source, period), what changed in the cockpit (goal statuses, KPIs off target), and the snapshot file path. Then run `/next` if the founder asks what to do with it.
