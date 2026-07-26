# Brand95 Blueprint — implementation notes

The Blueprint is a stage-gated state machine. A brand is in exactly one
primary stage at a time (workstreams may run in parallel inside it).

Stages (see `packages/domain/src/blueprint.ts` for the authoritative data):

| # | Stage | Purpose | Gate summary |
|---|-------|---------|--------------|
| 0 | Intake | Structure a loose idea | Intake complete + founder approves research spend |
| 1 | Discover | Is the opportunity worth validating? | Opportunity Memo + evidence + founder approval |
| 2 | Validate | Behavioral evidence before build cost | Behavioral targets met + founder approves build |
| 3 | Build Brand | Ownable, usable brand system | Brand system + legal checks + founder approval |
| 4 | Hero Product | One product worth building around | Golden sample + landed cost + production plan approved |
| 5 | Buying Experience | Genuinely purchasable and credible | E2E test order + QA + no placeholders |
| 6 | Launch | First 100 paying customers | 100 customers + margin measured + channel promise |
| 7 | Retail Validation | Retail as a measurable channel | 10 paying stockists + reorder signal + economics |
| 8 | Repeatable Growth | Predictable commercial engine | ≥1 repeatable channel + positive contribution |
| 9 | Brand Ecosystem | Expand only after hero validated | ≥3 viable SKUs or focused profitable assortment |
| 10 | Systemize & Scale | Runs without founder intervention | 4 founder-free weeks + owned processes |

## Rules encoded in the stage machine

- **Advance only to the next stage.** No skipping.
- **A gate passes only with an explicit founder decision** recorded as an
  `ApprovalDecision` on the gate's `ApprovalRequest` (Level 3).
- **Gate readiness ≠ gate passage.** Readiness is computed from criteria
  status (met / not met / waived-with-reason). Passage requires the decision.
- **Evidence attaches to criteria** (`GateEvidence`), each with type, source,
  and note — behavioral evidence is distinguishable from compliments.
- **Criteria may be waived** only with a recorded reason, and the waiver is
  visible in the gate view and the event log.
- **Parking/rejecting** a brand is always possible and logged as a decision.

## Evidence targets (defaults, adjustable per category with documented reason)

- Discover: ≥15 customer signals, ≥10 retailer signals (when retail plausible),
  ≥10 competitors reviewed, low/base/high unit economics.
- Validate: 100 qualified signups OR 25 paid reservations OR 10 credible
  retailer expressions with ≥3 written opening-order indications OR
  founder-approved equivalent.
- Launch: 100 paying customers, 20 substantive reviews, 10 usable UGC assets.
- Retail: 50 qualified prospects contacted, 10 paying stockists, ≥3 reorders.

## Route selection (retail-first / D2C-first / dual)

Chosen during Validate; stored with rationale in the Decision log. Camera95
defaults to dual validation. See spec §14.
