# Brand95 data model (Blueprint MVP slice)

Authoritative schema: `packages/database/prisma/schema.prisma`.

Conventions: UUID ids, `createdAt`/`updatedAt`, workspace ownership on
aggregate roots, soft archive via `archivedAt` where it matters, append-only
`Event` log.

## Implemented now

**Identity / portfolio**
- `Workspace`, `User` (role: FOUNDER | OPERATOR | VIEWER)
- `Brand` (codename, concept, status, route, currentStageIndex)
- `BrandStage` — one row per blueprint stage per brand, instantiated from the
  domain blueprint at creation; status: LOCKED | ACTIVE | COMPLETE | SKIPPED
- `StageGate` — the exit gate of a stage; status: NOT_READY | READY | PASSED
- `GateCriterion` — individual criteria; status: PENDING | MET | WAIVED
- `GateEvidence` — evidence rows attached to criteria (type, source, note)

**Work management**
- `Workstream` (BRAND | COMMERCIAL tracks per spec §2)
- `Task` (+ optional workstream, stage, assignee agent, dependencies via
  `TaskDependency`)
- `ApprovalRequest` / `ApprovalDecision` (levels 0–3, full request contents)
- `Decision` — the decision log (proceed/revise/park/reject, route choices…)
- `Risk` — initial risk register per brand
- `AgentRun` — a specialist agent invocation with handoff/result JSON payloads

**Knowledge**
- `Artifact` / `ArtifactVersion` — versioned outputs (memos, briefs, files)

**Audit**
- `Event` — append-only: actor (user/agent/system), verb, entity, payload

## Deliberately deferred (added with their milestone)

- Supply chain (`Supplier`, `Sample`, `Costing`, `PurchaseOrderDraft`, …) — Milestone 4/5
- Commerce (`Customer`, `Order`, `Refund`, …) — Shopify integration milestone
- Retail CRM (`Retailer`, `OutreachMessage`, `WholesaleOrder`, …) — Retail workflow milestone
- Marketing (`Campaign`, `Experiment`, `MetricObservation`, …) — Growth milestone
- Finance (`Budget`, `CashForecast`, `UnitEconomicsSnapshot`, …) — Finance milestone
- Integration plumbing (`IntegrationConnection`, `WebhookEvent`, `IdempotencyKey`,
  `ExternalObjectLink`) — first execution integration milestone

The spec's full entity list (§6) is the target; this file tracks what is live.
