# Brand95 integrations

All integrations use a typed adapter pattern; the core domain works without
any vendor. Every adapter ships with a mock implementation so workflows and
tests run with zero credentials. Real credentials are configured via
environment variables (`.env.example`) and a setup screen (Milestone 5).

| Integration | Use | Status |
|-------------|-----|--------|
| OpenAI | agent orchestration, structured generation | planned (Milestone 3/4) |
| Gmail | retail outreach, supplier comms — draft vs send, approval-gated | planned (Milestone 5) |
| Google Drive | brand assets, contracts, artifact links | planned (Milestone 5) |
| Google Calendar | buyer meetings, stage reviews | planned (Milestone 5) |
| Airtable | optional operational interface, imports | planned (Milestone 5) |
| Shopify | products, orders, inventory, publishing | planned (Milestone 5) |

Requirements carried from the spec (§10): external ID mapping, explicit field
ownership for two-way sync, conflict logs, webhook signature verification,
idempotency keys on all sends/writes, draft/publish workflows, reconciliation
jobs, and cost/token telemetry for AI calls.
