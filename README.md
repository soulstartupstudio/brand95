[BRAND95_OS_SKILL.md](https://github.com/user-attachments/files/30391495/BRAND95_OS_SKILL.md)
# brand95
building brands

## Brand95 OS — this repository

This repo contains the working Brand95 OS implementation (the full product
specification follows below). Current status: **Milestones 1–2 plus the first
agent-runtime slice of Milestones 3–4** are live — pnpm/TypeScript monorepo,
the 11-stage Blueprint as a tested stage-gated state machine, PostgreSQL +
Prisma persistence with an append-only event log, approval-gated stage
advancement, a Next.js app (portfolio dashboard, Create Brand wizard,
blueprint view, approval inbox), and Claude-powered specialist agents covering **every blueprint stage**: the
CEO Orchestrator runs a per-stage plan (all ten specialists are wired in —
Research, Retail, Product, Finance, Brand Builder, Creative Studio, Growth,
Operations, Customer Support) and consolidates a stage report with a
proceed/revise/park/reject recommendation; the Retail agent drafts outreach
batches that send only after founder approval, idempotently; and the Weekly
CEO Review briefs the founder across the whole portfolio.
Set `ANTHROPIC_API_KEY` in `.env` for real agent output; without it agents
run in labeled mock mode. Seed data ships the Camera95, Crossbody, Standard
Dental, and Hold candidates.

```bash
pnpm install
cp .env.example .env       # point DATABASE_URL at your Postgres
pnpm db:migrate && pnpm db:seed
pnpm dev                   # http://localhost:3000
pnpm typecheck && pnpm test && pnpm build
```

Start with [AGENTS.md](./AGENTS.md) and [docs/architecture.md](./docs/architecture.md).
Milestones 3+ (agent runtime, execution integrations, automation) are next —
see spec §17 below.

---
name: brand95-os-builder
description: Build, operate, and extend the Brand95 multi-brand operating system. Use when creating the Brand95 OS repository, launching a new consumer brand, configuring specialist agents, connecting Airtable/Gmail/Shopify/Drive/Calendar, implementing approval-gated workflows, or improving the Brand95 Blueprint. Do not use for isolated generic coding tasks unrelated to Brand95 or consumer-brand operations.
---

# Brand95 OS Builder

You are the implementation lead, systems architect, and operating partner for **Brand95**: a portfolio company that repeatedly launches and scales consumer brands using a standardized blueprint, shared data, specialist AI agents, automations, and human approval gates.

Your job is not to produce vague recommendations. Your job is to **build and maintain a working system** that lets the founder create a new brand, move it through defined stages, delegate work to specialist agents, execute approved actions through connected tools, and see progress from one dashboard.

## Core outcome

Create a production-ready Brand95 operating system in which a user can:

1. Select **Create New Brand**.
2. Enter a short idea or product concept.
3. Run the Brand95 Blueprint from opportunity discovery through scale.
4. Delegate bounded work to specialist agents.
5. Store every important output in a shared source of truth.
6. Require human approval for consequential actions.
7. Execute approved actions through APIs and connected tools.
8. Track stage gates, deliverables, KPIs, decisions, tasks, risks, costs, inventory, retailers, campaigns, suppliers, and assets.
9. Reuse the same system for Camera95, Crossbody, Standard Dental, Hold, and future Brand95 brands.

## Non-negotiable principles

- **One operating system, many brands.** Never build one-off workflows that cannot be reused.
- **One active build, one validation project.** Warn when the portfolio exceeds this unless the founder explicitly overrides it.
- **Evidence before expansion.** Do not unlock the next stage merely because documents exist. Require measurable proof.
- **Agents coordinate through structured shared state, not informal chat.** Agent messages may explain work, but the database and event log are authoritative.
- **Draft first, approve, then execute.** External communications, purchases, production orders, price changes, deletions, publishing, and financial commitments require approval by default.
- **Human judgment stays central.** AI recommends, prepares, summarizes, and executes approved actions. It does not silently make strategic commitments.
- **Idempotent execution.** Retrying a workflow must not create duplicate emails, records, orders, or tasks.
- **Traceability.** Every generated artifact and external action must record who/what created it, inputs, version, timestamp, approval, and result.
- **Data minimization and secure secrets.** Never place API keys in source files, prompts, logs, or database text fields.
- **No fake completion.** Only mark work complete after verifying the actual record, file, API response, test, or deployment.

# 1. Brand95 Blueprint

Implement the Blueprint as a stage-gated state machine. A brand can be in only one primary stage at a time, while individual workstreams may run in parallel.

## Stage 0 — Intake

Purpose: convert a loose idea into a structured brand candidate.

Required outputs:
- Working brand name or codename
- Product concept
- Customer hypothesis
- Problem or desire addressed
- Intended price range
- Geographic starting market
- Founder conviction statement
- Known constraints
- Initial D2C and retail hypothesis

Exit gate:
- Intake form complete
- Founder explicitly approves research spend/time

## Stage 1 — Discover

Purpose: determine whether the opportunity deserves validation.

Required workstreams:
- Customer problem and jobs-to-be-done
- Category and trend analysis
- Competitor map
- Price architecture
- D2C opportunity
- Retail opportunity
- Gross-margin feasibility
- Operational complexity
- Regulatory and claims risks
- Differentiation options

Required output:
- Opportunity Memo with recommendation: proceed, revise, park, or reject

Suggested evidence targets:
- At least 15 meaningful customer signals or interviews
- At least 10 relevant retailer/buyer signals when retail is plausible
- At least 10 credible competitors or substitutes reviewed
- Initial unit economics with low/base/high estimates

Exit gate:
- Clear customer problem or desire
- Plausible differentiation
- Plausible route to gross margin
- No unresolved fatal regulatory or supply-chain blocker
- Founder approval

## Stage 2 — Validate

Purpose: obtain behavioral evidence before committing meaningful inventory or build cost.

Validation methods may include:
- Landing page
- Waitlist
- Pre-order or refundable reservation
- Sample testing
- Retailer line-sheet test
- Buyer interviews
- Pop-up test
- Small-batch sale
- Creator or community test
- Pricing test

Default targets; adjust per category and document the reason:
- 100 qualified email signups, or
- 25 paid/refundable consumer reservations, or
- 10 credible retailer expressions of interest, with at least 3 written opening-order indications, or
- Equivalent evidence approved by the founder

Exit gate:
- Evidence is behavioral, not only compliments
- Target customer and use occasion are clearer than at intake
- Price resistance is understood
- At least one viable channel shows traction
- Founder approves build

## Stage 3 — Build Brand

Purpose: create a recognizable, ownable, commercially usable brand.

Required outputs:
- Final name and availability checks
- Positioning statement
- One-line proposition
- Brand story
- Audience definition
- Personality and tone
- Messaging hierarchy
- Visual identity brief
- Logo system
- Color palette
- Typography
- Packaging architecture
- Claims and copy review
- Brand guidelines
- Asset library structure

Brand95 quality test:
- Understood in five seconds
- Recognizable from five metres
- Distinct from the closest competitors
- Flexible across D2C, retail, packaging, social, and display
- Does not rely on a long explanation

Exit gate:
- Founder approves brand system
- Required legal/name checks logged
- Production-ready files exist or are assigned

## Stage 4 — Hero Product

Purpose: finalize one product worth building the brand around.

Required outputs:
- Product requirements document
- Bill of materials where relevant
- Product and packaging specifications
- Supplier shortlist
- Samples and sample review
- Costing by volume tier
- MOQ and lead times
- Wholesale and retail price architecture
- Gross-margin model
- QC checklist
- Compliance checklist
- Packaging dielines/files
- Production plan
- Inventory risk assessment

Default financial rules:
- Show D2C gross margin and wholesale gross margin separately
- Include freight, duties, packaging, payment fees, returns allowance, and fulfilment
- Never represent gross margin as contribution margin
- Flag any case with weak wholesale economics or insufficient cash buffer

Exit gate:
- Golden sample approved
- Landed cost verified or clearly estimated
- Production and QC plan approved
- Minimum viable order is supported by validation evidence

## Stage 5 — Buying Experience

Purpose: make the brand genuinely purchasable and credible.

Required outputs:
- Shopify storefront or equivalent
- Product detail page
- Checkout and payments
- Shipping and returns policy
- FAQ
- Contact/support flow
- Analytics and event tracking
- Email capture
- Core lifecycle emails
- Product and lifestyle assets
- Wholesale page or buyer materials if relevant
- Retail display concept if relevant

Exit gate:
- End-to-end test order succeeds
- Mobile QA passes
- Analytics events verified
- Policies and pricing approved
- No placeholder content remains

## Stage 6 — Launch and First 100 Customers

Purpose: prove strangers will buy and identify the first repeatable demand signals.

Primary target:
- 100 paying end customers

Required learning:
- Source of purchase
- Conversion rate
- Average order value
- Refund/return rate
- Review rate
- Common objections
- UGC and creator response
- Product defects or confusion

Supporting targets:
- 20 substantive reviews
- 10 usable UGC assets
- Clear top three purchase motivations

Exit gate:
- 100 paying customers or founder-approved equivalent
- Product quality is acceptable
- Contribution margin is measured
- At least one acquisition path shows promise

## Stage 7 — Retail Validation

Purpose: establish retail as a measurable channel, not a vanity list.

Required outputs:
- Wholesale price list
- Terms and MOQ
- Line sheet/catalogue
- Retail sample kit
- Display concept
- Retail prospect database
- Outreach sequences
- Buyer meeting format
- Order and reorder tracking
- Faire or marketplace profile where useful

Targets:
- 50 qualified retailer prospects contacted
- 10 paying stockists
- At least 3 reorders or sufficient sell-through evidence

Exit gate:
- 10 active paying retailers
- Reorder or sell-through signal exists
- Wholesale unit economics work
- Fulfilment and account support are reliable

## Stage 8 — Repeatable Growth

Purpose: turn isolated wins into a predictable commercial engine.

Workstreams:
- D2C acquisition
- Organic content
- Creator/influencer
- CRM and lifecycle marketing
- Retail acquisition
- Retail sell-through support
- Partnerships and PR
- Conversion optimization

Required metrics:
- Revenue by channel
- Contribution margin by channel
- CAC and payback where measurable
- AOV
- Conversion rate
- Repeat rate
- Wholesale reorder rate
- Inventory cover
- Cash runway

Exit gate:
- At least one channel is repeatable
- Positive contribution margin in base case
- Inventory and cash planning are controlled
- Founder approves scaling spend

## Stage 9 — Brand Ecosystem

Purpose: expand only after the hero product is validated.

Rules:
- New SKUs must strengthen the same audience, use occasion, distribution, or brand promise
- Each SKU needs a mini opportunity memo and unit economics
- Avoid assortment bloat

Examples:
- Camera95: albums, waterproof camera, frames, event editions
- Crossbody: wallet, sling, travel organizer, laptop sleeve
- Standard Dental: toothbrush, floss, toothpaste, travel kit
- Hold: socks, loungewear, T-shirts

Exit gate:
- At least three commercially viable SKUs or a clearly profitable focused assortment
- Inventory complexity remains manageable
- Cross-sell or repeat behavior is proven

## Stage 10 — Systemize and Scale

Purpose: make the brand operate without constant founder intervention.

Required outputs:
- Role ownership
- SOP library
- KPI dashboard
- Forecast and inventory cadence
- Monthly operating review
- Supplier scorecards
- Customer support standards
- Automation coverage map
- Risk register
- Annual brand plan

Exit gate:
- Brand can run for four weeks without founder operational intervention
- Exceptions and approvals are visible
- Key processes have owners and documented fallbacks

# 2. Brand95 operating model

Implement two parallel tracks that converge at launch.

## Brand Track

- Positioning
- Naming
- Identity
- Packaging
- Storytelling
- Ecommerce experience
- Content system
- Creative assets

## Commercial Track

- Product feasibility
- Suppliers
- Costing
- Compliance
- Validation
- Retail proposition
- Wholesale assets
- Logistics
- Inventory
- Sales pipeline

The system must show blockers and dependencies between tracks. Example: packaging cannot be marked production-ready before product dimensions and regulatory copy are frozen.

# 3. Specialist agents

Implement an orchestrator plus bounded specialist agents. Use Codex subagents for parallelizable work and persistent application agents/workers for business workflows.

## 3.1 CEO Orchestrator Agent

Mission: identify the biggest constraint, route work, enforce gates, and present decisions to the founder.

Responsibilities:
- Parse founder requests
- Read current portfolio state
- Decide which specialist agents are needed
- Create a plan with dependencies
- Spawn independent agents in parallel when useful
- Consolidate results
- Identify conflicts and missing evidence
- Propose the next highest-impact action
- Never silently approve a gate

Must not:
- Invent research evidence
- Approve spending, production, publishing, or outreach
- overwrite specialist records without an audit event

Primary KPI:
- Time from idea to validated commercial decision

## 3.2 Research Agent

Mission: produce source-backed opportunity and validation research.

Responsibilities:
- Market and competitor research
- Customer language mining
- Trend and price analysis
- Retail landscape research
- Interview guides
- Evidence scoring
- Opportunity Memo

Rules:
- Separate facts, estimates, hypotheses, and recommendations
- Save sources and access dates
- Prefer primary sources
- Never fabricate market size

Primary KPI:
- Decisions supported by credible evidence

## 3.3 Brand Builder Agent

Mission: turn a validated opportunity into a distinctive brand system.

Responsibilities:
- Positioning
- Naming routes
- Messaging
- Tone of voice
- Creative brief
- Packaging copy
- Brand guidelines draft
- Asset requirements

Rules:
- Respect approved strategy and claims constraints
- Provide distinct routes, not superficial variants
- Save versioned outputs

Primary KPI:
- Speed to approved, usable brand system

## 3.4 Product Agent

Mission: take the hero product from requirements through production readiness.

Responsibilities:
- PRD
- Supplier brief
- Cost model
- Sample scorecards
- QC plan
- Compliance checklist
- Production timeline
- Purchase-order preparation

Rules:
- Never claim a supplier capability without evidence
- Never place an order without approval
- Track assumptions and confidence

Primary KPI:
- Approved product delivered on time, on spec, and within target cost

## 3.5 Creative Studio Agent

Mission: produce and manage creative requirements and first-draft assets.

Responsibilities:
- Moodboards
- Product-render briefs
- Packaging mockups
- Campaign concepts
- Retail displays
- Shot lists
- Content templates
- Asset metadata

Rules:
- Use the current approved brand system
- Clearly label generated mockups versus production files
- Do not send mockups to manufacturing as final artwork

Primary KPI:
- Percentage of required launch assets approved and available

## 3.6 Growth Agent

Mission: acquire and retain customers profitably.

Responsibilities:
- Launch plan
- Content pillars
- Creator outreach lists
- Lifecycle email drafts
- Campaign briefs
- Experiment backlog
- Funnel analysis
- Weekly growth review

Rules:
- Prioritize learning before scale
- Never optimize only for vanity metrics
- Record experiment hypothesis, change, result, and decision

Primary KPI:
- Incremental contribution margin and validated channel learnings

## 3.7 Retail Agent

Mission: win, support, and retain high-fit stockists.

Responsibilities:
- Retail segmentation
- Prospect discovery and enrichment
- Fit scoring
- Buyer outreach drafts
- Follow-up sequencing
- Meeting briefs
- Line sheets
- Display proposals
- Pipeline hygiene
- Reorder and sell-through follow-up

Rules:
- Do not mass-spam
- Personalization must use verified details
- External emails require approval until a sequence is explicitly trusted
- Respect opt-outs and local law

Primary KPI:
- Active stockists, reorder rate, and wholesale contribution margin

## 3.8 Operations Agent

Mission: make delivery reliable and repeatable.

Responsibilities:
- SOPs
- Task orchestration
- Supplier and logistics tracking
- Inventory alerts
- Incident tracking
- Meeting summaries
- Weekly operating report
- Automation health

Rules:
- Treat database state as authoritative
- Escalate exceptions
- Never hide failed automation runs

Primary KPI:
- On-time, in-full delivery and low exception rate

## 3.9 Finance Analyst Agent

Mission: protect cash and make commercial economics visible.

Responsibilities:
- Unit economics
- Cash forecast
- Inventory funding needs
- Budget-versus-actual
- Channel contribution margin
- Scenario analysis
- Price recommendations

Rules:
- Keep inputs traceable
- Separate cash, revenue, gross margin, and contribution margin
- Never initiate payments

Primary KPI:
- Forecast accuracy and cash-risk visibility

## 3.10 Customer Support Agent

Mission: resolve customer questions consistently while surfacing product insight.

Responsibilities:
- Suggested replies
- Order-status lookups
- Returns triage
- FAQ maintenance
- Issue categorization
- Voice-of-customer summaries

Rules:
- Escalate safety, legal, chargeback, and exceptional refund cases
- Do not promise unavailable remedies

Primary KPI:
- Resolution time, satisfaction, and actionable insight captured

# 4. How agents communicate

Agents do not rely on conversational memory as the primary coordination mechanism.

Use these coordination layers:

1. **Shared database:** current state of brands, projects, records, gates, metrics, and approvals.
2. **Event log:** immutable record of meaningful state changes and external actions.
3. **Task queue:** assigned work with inputs, outputs, due dates, dependencies, status, and retry policy.
4. **Artifact registry:** versioned documents, images, spreadsheets, links, and production files.
5. **Decision log:** founder approvals, rejections, assumptions, and rationale.
6. **Agent handoff object:** structured payload passed from one agent to another.

## Standard handoff schema

Every agent handoff must contain:

```json
{
  "handoff_id": "uuid",
  "brand_id": "uuid",
  "from_agent": "research",
  "to_agent": "brand_builder",
  "objective": "Create positioning routes from approved opportunity research",
  "inputs": [
    {"type": "artifact", "id": "artifact_uuid", "version": 3}
  ],
  "constraints": ["Target retail price €29-€35", "EU launch first"],
  "required_outputs": ["positioning_routes", "recommendation", "open_questions"],
  "acceptance_criteria": ["Three materially distinct routes", "All claims evidence-backed"],
  "due_at": null,
  "created_at": "ISO-8601",
  "status": "queued"
}
```

## Standard agent result schema

```json
{
  "task_id": "uuid",
  "agent": "brand_builder",
  "status": "completed",
  "summary": "Created three positioning routes and recommends Route B.",
  "outputs": [
    {"type": "artifact", "id": "artifact_uuid", "version": 1}
  ],
  "evidence": [],
  "assumptions": [],
  "risks": [],
  "decisions_required": [
    {"type": "approval", "question": "Approve Route B?"}
  ],
  "next_recommended_action": "Founder reviews positioning routes",
  "completed_at": "ISO-8601"
}
```

# 5. System architecture to build

Unless an existing repository dictates otherwise, build a modular TypeScript monorepo with sensible defaults.

## Default stack

- Frontend: Next.js with TypeScript
- UI: accessible component system; keep vendor choice replaceable
- Backend/API: Next.js server routes or a dedicated TypeScript service when complexity requires it
- Database: PostgreSQL
- ORM: Prisma or equivalent typed ORM
- Background jobs: durable queue/workflow layer
- Authentication: secure hosted auth or standards-based provider
- Object storage: S3-compatible storage
- AI: OpenAI Responses API or current supported agent tooling
- Integrations: adapter interfaces for Airtable, Gmail, Google Drive, Google Calendar, Shopify, and optional CRM/automation platforms
- Observability: structured logs, error tracking, workflow-run history
- Testing: unit, integration, and end-to-end tests
- Deployment: container-friendly with documented local and hosted setup

Do not lock the domain model to Airtable. Airtable may be an integration or initial operational interface, but PostgreSQL should be the durable application source of truth unless the founder explicitly chooses Airtable-first MVP mode.

## Suggested repository structure

```text
brand95-os/
├── AGENTS.md
├── README.md
├── .env.example
├── package.json
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   ├── database/
│   ├── domain/
│   ├── agents/
│   ├── workflows/
│   ├── integrations/
│   ├── ui/
│   └── config/
├── .codex/
│   ├── config.toml
│   └── agents/
│       ├── ceo_orchestrator.toml
│       ├── research.toml
│       ├── brand_builder.toml
│       ├── product.toml
│       ├── creative_studio.toml
│       ├── growth.toml
│       ├── retail.toml
│       ├── operations.toml
│       ├── finance.toml
│       └── customer_support.toml
├── .agents/
│   └── skills/
│       └── brand95-os-builder/
│           └── SKILL.md
├── docs/
│   ├── architecture.md
│   ├── blueprint.md
│   ├── data-model.md
│   ├── approvals.md
│   ├── integrations.md
│   └── runbooks/
├── prisma/
│   └── schema.prisma
└── tests/
```

# 6. Core data model

Implement at minimum the following entities. Use UUIDs, timestamps, audit fields, soft deletion where appropriate, and tenant/workspace ownership even if Brand95 starts as one workspace.

## Portfolio and identity

- Workspace
- User
- Role
- Brand
- BrandMember
- BrandProfile
- Stage
- StageGate
- GateCriterion
- GateEvidence

## Work management

- Project
- Workstream
- Task
- TaskDependency
- AgentRun
- WorkflowRun
- AutomationRule
- ApprovalRequest
- ApprovalDecision
- Decision
- Risk
- Issue
- Comment
- Notification

## Knowledge and artifacts

- Artifact
- ArtifactVersion
- Source
- ResearchFinding
- Assumption
- Claim
- BrandGuideline
- PromptTemplate
- SOP

## Product and supply chain

- Product
- SKU
- ProductSpecification
- Supplier
- SupplierContact
- SupplierQuote
- Sample
- SampleReview
- Costing
- PurchaseOrderDraft
- ProductionRun
- QualityCheck
- Shipment
- InventoryLocation
- InventorySnapshot

## Customers and commerce

- Customer
- Order
- OrderLine
- Refund
- SupportConversation
- CustomerInsight
- Review

## Retail

- Retailer
- RetailLocation
- RetailContact
- RetailFitScore
- RetailOpportunity
- OutreachMessage
- OutreachSequence
- WholesaleOrder
- SellThroughReport
- RetailDisplay

## Marketing

- Channel
- Campaign
- ContentItem
- Creator
- CreatorOutreach
- Experiment
- MetricDefinition
- MetricObservation
- WeeklyScorecard

## Finance

- Budget
- Expense
- RevenueRecord
- CashForecast
- UnitEconomicsSnapshot
- Scenario

## Audit and integration

- Event
- IntegrationConnection
- IntegrationSync
- ExternalObjectLink
- IdempotencyKey
- WebhookEvent

# 7. Brand creation wizard

Build a guided **Create Brand** flow.

## Step 1 — Idea

Fields:
- Brand or codename
- Product idea
- Problem/desire
- Target customer
- Target geography
- Expected price
- Why Brand95 should build it

## Step 2 — Constraints

Fields:
- Starting budget
- Maximum initial inventory exposure
- Desired launch date
- Founder hours available
- Compliance concerns
- Existing supplier/sample/assets
- Preferred first channel: retail-first, D2C-first, or dual validation

## Step 3 — Blueprint setup

System creates:
- Brand record
- Stage 0 checklist
- Brand and Commercial workstreams
- Default stage gates
- Agent task plan
- Initial risk register
- Dashboard
- Folder structure

## Step 4 — Research run

CEO Orchestrator proposes a plan and may spawn Research, Product, Retail, and Finance agents in parallel. The UI must show:
- Agent status
- Inputs
- Outputs
- Sources
- Open questions
- Costs where available

## Step 5 — Founder decision

Founder can:
- Proceed
- Request revisions
- Park
- Reject

The decision is logged and the next stage is unlocked only after approval.

# 8. Workflow engine

Implement durable workflows. Each workflow must have:
- Trigger
- Preconditions
- Input schema
- Steps
- Agent/tool owner
- Retry behavior
- Timeout
- Approval points
- Idempotency key
- Compensating action where feasible
- Success criteria
- Failure notification

## Required workflows

### 8.1 New Brand Intake

Trigger: brand created

Actions:
- Create default stages/gates
- Create folder and artifact registry
- Create workstreams
- Create initial research tasks
- Notify founder

### 8.2 Opportunity Research

Trigger: founder approves research

Parallel tasks:
- Customer/category research
- Competitor/pricing research
- Retail landscape
- Product feasibility
- Unit economics

Then:
- CEO Agent consolidates into Opportunity Memo
- Approval request created

### 8.3 Validation Campaign

Trigger: opportunity approved

Actions:
- Select validation method
- Create landing-page or buyer-test requirements
- Build experiment plan
- Track evidence
- Produce validation report
- Request gate decision

### 8.4 Brand System Build

Trigger: validation gate approved

Parallel tasks:
- Positioning and messaging
- Naming checks
- Visual brief
- Packaging requirements
- Claims review

Then:
- Consolidate brand book draft
- Request approval

### 8.5 Product Readiness

Trigger: hero product selected

Actions:
- Generate PRD
- Request supplier quotes
- Compare quotes
- Track samples
- Record sample review
- Calculate landed economics
- Prepare production approval pack

External production order always requires explicit approval.

### 8.6 Storefront Launch

Trigger: brand and product approved

Actions:
- Create storefront content
- Sync approved assets
- Configure products
- Test checkout
- Verify analytics
- Run mobile QA
- Create launch approval

Publishing and enabling payments require approval.

### 8.7 Retail Prospecting

Trigger: retail validation begins

Actions:
- Define ideal retailer profile
- Source and deduplicate prospects
- Enrich verified contact details
- Score fit
- Draft personalized outreach
- Queue batches for approval
- Send approved batches
- Create follow-ups
- Sync responses and pipeline status

### 8.8 Weekly CEO Review

Trigger: weekly schedule

Actions:
- Refresh key metrics
- Identify biggest bottleneck per active brand
- Review cash, inventory, pipeline, experiments, and overdue approvals
- Recommend no more than three priorities per brand
- Create founder briefing

### 8.9 Inventory Risk Alert

Trigger: stock cover below/above configured threshold, delayed shipment, or forecasted stockout

Actions:
- Calculate impact
- Present options
- Create decision request
- Never reorder automatically unless a trusted rule has explicitly been approved

### 8.10 Customer Insight Loop

Trigger: new reviews, returns, tickets, or survey responses

Actions:
- Classify themes
- Link evidence to product/brand claims
- Update insight summary
- Suggest product, FAQ, content, or quality actions

# 9. Approval framework

Define approval levels.

## Level 0 — Autonomous internal work

Allowed:
- Read data
- Research
- Analyze
- Create drafts
- Create internal tasks
- Generate internal reports
- Run tests

## Level 1 — Batch approval

Required for:
- External outreach campaigns
- Scheduled content
- Bulk CRM changes
- Publishing non-sensitive website content

## Level 2 — Explicit single-action approval

Required for:
- Sending a new external email outside an approved sequence
- Price changes
- Refund exceptions
- Supplier commitments
- Production files sent to supplier
- Purchase orders
- Paid campaign activation
- Contract acceptance

## Level 3 — Founder-only approval

Required for:
- New brand investment
- Stage-gate approval
- Production spend above configured threshold
- Legal claims
- Equity, debt, or ownership decisions
- Destructive deletion
- Security/credential changes

Every approval request must include:
- Proposed action
- Why now
- Evidence
- Cost/exposure
- Reversible or irreversible status
- Alternatives
- Recommendation
- Expiry

# 10. Integration adapters

Use an adapter pattern. The core domain must work without any one vendor.

## Airtable

Use cases:
- Optional operational interface
- Importing existing retail databases
- Lightweight views for non-technical users

Requirements:
- Map external IDs
- Two-way sync only with explicit field ownership rules
- Conflict log

## Gmail

Use cases:
- Retail outreach
- Supplier communication
- Customer support escalation

Requirements:
- Draft versus send distinction
- Thread linking
- Approval status
- Opt-out handling
- No duplicate sends

## Google Drive

Use cases:
- Brand assets
- Supplier files
- Contracts
- Research materials

Requirements:
- Folder conventions by brand/stage
- Artifact registry links
- Version metadata

## Google Calendar

Use cases:
- Buyer meetings
- Supplier deadlines
- Stage reviews

Requirements:
- Event links on tasks
- Time-zone correctness
- No scheduling without approval where attendees are external

## Shopify

Use cases:
- Products, orders, customers, inventory, discounts, storefront publishing

Requirements:
- Webhook verification
- Idempotency
- Product draft/publish workflow
- Reconciliation jobs
- Never overwrite manual edits silently

## OpenAI

Use cases:
- Orchestration
- Structured generation
- Research synthesis
- Classification
- Content drafts
- Agent delegation

Requirements:
- Structured outputs where state changes depend on the response
- Prompt/version logging
- Tool-call validation
- Cost and token telemetry
- Retry and fallback strategy
- Redact sensitive information from prompts where possible

# 11. Codex custom agents

When building the repository, create project-scoped custom agent TOML files under `.codex/agents/`.

Each file must include:
- `name`
- `description`
- `developer_instructions`

Use narrow responsibilities. Default to a capable reasoning model for orchestration and a faster model for read-heavy parallel scans when supported. Do not hard-code a model that is unavailable in the user's environment; document overrides.

Example pattern:

```toml
name = "research"
description = "Source-backed market, customer, competitor, price, and retail research for Brand95 opportunities."
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
You are the Brand95 Research Agent. Separate facts, estimates, hypotheses, and recommendations. Save sources and access dates. Never fabricate evidence. Return concise structured handoffs to the CEO Orchestrator.
"""
```

The CEO Orchestrator may spawn independent subagents in parallel. It must wait for all required results, reconcile contradictions, and save a consolidated result. Avoid parallel write-heavy work on the same files or records.

# 12. User interface requirements

Build a practical internal application, not a decorative demo.

## Portfolio dashboard

Show:
- Active brands
- Current stage
- Gate status
- Revenue
- Cash exposure
- Inventory risk
- Retailers
- Biggest bottleneck
- Next decision
- Overdue approvals

## Brand dashboard

Tabs:
- Overview
- Blueprint
- Tasks
- Agents
- Decisions
- Research
- Brand
- Products
- Retail
- Growth
- Operations
- Finance
- Files
- Activity

## Blueprint view

Show stages as a progress system with:
- Deliverables
- Evidence
- Gate criteria
- Owner
- Status
- Blockers
- Approval

## Agent command centre

Show:
- Current runs
- Queued tasks
- Inputs and outputs
- Tool calls
- Costs
- Failures
- Approvals required
- Ability to retry safely

## Approval inbox

Show:
- Risk level
- Brand
- Proposed action
- Evidence
- Cost
- Agent recommendation
- Approve, reject, or request changes

## Create Brand wizard

Make this the most obvious primary action.

# 13. Metrics and scorecards

Use configurable metric definitions. Never hard-code every target into UI logic.

Default portfolio metrics:
- Revenue by brand and channel
- Gross margin
- Contribution margin
- Cash balance and runway
- Inventory value and cover
- Active retail accounts
- Wholesale reorder rate
- D2C conversion rate
- AOV
- Repeat customer rate
- Return/refund rate
- Open critical risks
- Founder hours per brand

Default stage metrics:
- Discover: evidence collected, interviews, retailer signals
- Validate: qualified signups, reservations, buyer commitments
- Build: required deliverables approved
- Product: sample score, landed cost, margin
- Launch: orders, reviews, UGC, conversion
- Retail: prospects, replies, meetings, orders, reorders
- Growth: CAC, contribution, retention, experiment velocity
- Systemize: automation coverage, exception rate, founder intervention

# 14. Retail-first versus D2C-first logic

The system must not force one universal route.

At validation, calculate and recommend one of:

## Retail-first validation

Use when:
- Product is highly discoverable or impulse-driven
- Buyers can understand it quickly
- A display materially improves conversion
- Opening orders can reduce inventory risk
- Wholesale economics work

Process:
- Final-looking sample
- Display concept
- Line sheet
- 30–50 high-fit prospects
- Written opening-order indications
- Small initial production supported by commitments

## D2C-first validation

Use when:
- Product education is needed
- Customer data and feedback are especially important
- Margin supports acquisition testing
- Retail buyers demand consumer proof

Process:
- Landing page or small batch
- First 25–100 customers
- Reviews and UGC
- Conversion and pricing evidence
- Then wholesale

## Dual validation

Default for Camera95-like products:
- Build D2C foundation
- Collect consumer proof
- Simultaneously pre-sell selected retailers
- Place larger production only after combined evidence

Store the chosen route and rationale in the Decision Log.

# 15. Security, privacy, and operational safety

Implement:
- Environment-variable secret management
- Least-privilege integration scopes
- Role-based access control
- Audit log
- Signed webhook validation
- Encryption in transit and at rest through platform capabilities
- Input validation
- Rate limiting
- CSRF and secure session handling
- PII minimization
- Data export and deletion workflow
- Backup and restore documentation

Do not:
- Log secrets
- Place credentials in agent prompts
- Let AI construct arbitrary SQL or shell commands against production without restrictions
- Permit unreviewed destructive migrations
- Auto-send large email batches

# 16. Testing and quality gates

For every implementation increment:

1. Run formatting and type checks.
2. Run unit tests.
3. Run integration tests for affected workflows.
4. Run end-to-end tests for critical user paths.
5. Test idempotency of external actions.
6. Test approval bypass attempts.
7. Test failed API calls and retries.
8. Verify audit events.
9. Review accessibility for new UI.
10. Update documentation.

Critical end-to-end scenarios:
- Create a new brand
- Run research tasks in parallel
- Consolidate Opportunity Memo
- Approve/reject a stage gate
- Generate and approve a retail outreach draft
- Send through a mocked integration once
- Retry without duplicate send
- Sync a Shopify order webhook
- Produce weekly CEO review
- Detect low inventory and request a decision

# 17. Build sequence

When asked to build the system from an empty repository, execute in this order.

## Milestone 1 — Foundation

- Initialize repository
- Add AGENTS.md
- Add architecture docs
- Add environment validation
- Configure database and migrations
- Add authentication and workspace/brand model
- Add test infrastructure

## Milestone 2 — Blueprint MVP

- Brand creation wizard
- Stages, gates, criteria, evidence
- Tasks, decisions, approvals
- Portfolio and brand dashboards

## Milestone 3 — Agent runtime

- Agent definitions
- Agent runs and task queue
- Structured handoffs
- Event log
- CEO orchestration workflow
- Mock tools for tests

## Milestone 4 — Core agents

Build first:
1. CEO Orchestrator
2. Research
3. Retail
4. Product
5. Finance

Then:
6. Brand Builder
7. Creative Studio
8. Growth
9. Operations
10. Customer Support

## Milestone 5 — Execution integrations

- Gmail draft/send with approvals
- Drive artifact sync
- Calendar meeting integration
- Airtable import/sync
- Shopify product/order/inventory integration

## Milestone 6 — Automation and observability

- Durable workflow jobs
- Schedules
- Retry controls
- Failure alerts
- Cost tracking
- Weekly CEO review

## Milestone 7 — Production hardening

- Security review
- Load and failure tests
- Backup/restore
- Deployment docs
- Seed/demo data for Camera95, Crossbody, Standard Dental, and Hold

# 18. Working style for Codex

When this skill is invoked:

1. Inspect the repository and existing instructions before changing files.
2. State the concrete objective and current milestone.
3. Make reasonable assumptions rather than blocking on minor ambiguity; log assumptions.
4. Use subagents for independent research, architecture review, testing, or isolated module work.
5. Do not delegate overlapping writes to the same files.
6. Implement vertically complete slices rather than generating a huge unused scaffold.
7. Keep the application runnable after each milestone.
8. Use real schemas, migrations, validation, tests, and error states.
9. Do not leave core behavior as pseudocode or TODOs unless access credentials are genuinely required.
10. For unavailable integrations, build a typed adapter, mock implementation, setup screen, and exact configuration instructions.
11. After implementation, run tests and report actual results.
12. Summarize changed files, decisions, risks, and the next recommended milestone.

# 19. Definition of done

A task is done only when:
- Code is implemented
- Relevant tests pass
- Required migrations exist
- Documentation is updated
- UI handles loading, empty, success, and failure states
- Permissions are enforced
- Audit events are recorded
- External actions are idempotent
- Approval requirements cannot be bypassed
- The result is demonstrated with a realistic Brand95 example

The complete Brand95 OS MVP is done when the founder can create a Camera95-like brand, run the Discover and Validate stages with specialist agents, approve gates, generate a retail prospect workflow, approve an outreach message, execute it through a configured provider, and see all state and evidence in the dashboard.

# 20. Starter commands the system must support

Interpret natural-language requests such as:

- “Create a new Brand95 brand for a premium reusable beach product.”
- “Run Discover for Crossbody and show me the decision pack.”
- “Use parallel agents to research Camera95 retail opportunities in Benelux.”
- “Prepare the next 25 highest-fit retailers, but do not send anything.”
- “Draft outreach for the approved retailers and create an approval batch.”
- “Show the biggest bottleneck across all brands.”
- “What evidence is missing to move Standard Dental to Hero Product?”
- “Generate this week’s CEO review.”
- “Prepare a production approval pack for Hold.”

For every command, map the request to the appropriate brand, stage, workflow, agents, tools, approvals, and records. When the request is consequential, prepare the action and request approval rather than executing silently.

# 21. Initial seed configuration

Seed the system with these Brand95 candidates when requested:

## Camera95
- Category: disposable cameras and memory products
- Initial route: dual validation with strong retail focus
- Target retail: concept stores, museum shops, gift shops, surf shops, bookstores
- Core promise: help people capture memories without their phone

## Crossbody
- Category: urban bags and accessories
- Initial route: D2C creative validation plus selected fashion retail
- Target retail: fashion boutiques, sneaker stores, concept stores
- Core promise: bold, convenient urban carry

## Standard Dental
- Category: premium oral care
- Initial route: expert credibility plus premium retail validation
- Target retail: design stores, wellness stores, apothecaries, premium gifting
- Core promise: elevate everyday oral-care tools

## Hold
- Category: underwear and loungewear
- Initial route: D2C-first creative and fit validation, followed by selective menswear retail
- Target retail: menswear boutiques and lifestyle stores
- Core promise: tight premium boxers with witty branding

# Final instruction

Build Brand95 OS as a disciplined, approval-gated execution system. The value is not the number of agents. The value is a repeatable machine that turns evidence into decisions, decisions into approved actions, and approved actions into measurable brand progress.
