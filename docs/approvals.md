# Brand95 approval framework

Authoritative policy lives in `packages/domain/src/approvals.ts`. The workflow
layer enforces it; the UI only renders it.

## Levels

| Level | Name | Examples |
|-------|------|----------|
| 0 | Autonomous internal work | read, research, analyze, drafts, internal tasks/reports, tests |
| 1 | Batch approval | outreach campaigns, scheduled content, bulk CRM changes, non-sensitive publishing |
| 2 | Explicit single-action approval | new external email, price change, refund exception, supplier commitment, production files to supplier, purchase order, paid campaign activation, contract acceptance |
| 3 | Founder-only | new brand investment, stage-gate approval, production spend above threshold, legal claims, equity/debt/ownership, destructive deletion, security/credential changes |

## Approval request contents (required)

Every `ApprovalRequest` records: proposed action, why now, evidence,
cost/exposure, reversible-or-irreversible status, alternatives, the agent
recommendation, and an expiry. Requests without these fields should be
rejected at the validation layer (zod schema in the domain package).

## Lifecycle

```
draft ─► pending ─► approved ─► executed
                 ├► rejected
                 ├► changes_requested ─► (revised, back to pending)
                 └► expired
```

- A request is decided exactly once (`ApprovalDecision` is unique per request).
- Execution records an `Event` and, for external actions, an `IdempotencyKey`
  so retries can never duplicate the side effect.
- Stage-gate approvals are Level 3 and are the only way a brand advances.
