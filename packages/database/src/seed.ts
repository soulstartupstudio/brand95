import { randomUUID } from "node:crypto";
import {
  agentHandoffSchema,
  agentResultSchema,
  getStage,
} from "@brand95/domain";
import { prisma } from "./client";
import { createBrandWithBlueprint } from "./workflows/create-brand";
import {
  decideApproval,
  recordEvidence,
  requestGateApproval,
  setCriterionStatus,
} from "./workflows/gates";

/**
 * Seed: one workspace, founder + operator, and the four Brand95 candidates
 * (spec §21) in realistic states:
 *  - Camera95        ACTIVE, Stage 1 Discover (intake gate passed, dual route)
 *  - Crossbody       ACTIVE, Stage 0 with a PENDING gate approval (inbox demo)
 *  - Standard Dental PARKED at Stage 0
 *  - Hold            ACTIVE, Stage 0 fresh intake
 * Idempotent: exits early if the workspace already exists.
 */

async function main() {
  const existing = await prisma.workspace.findFirst({
    where: { name: "Brand95" },
  });
  if (existing) {
    console.log("Workspace already seeded — nothing to do.");
    return;
  }

  const workspace = await prisma.workspace.create({ data: { name: "Brand95" } });
  const founder = await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      email: "founder@brand95.example",
      name: "Founder",
      role: "FOUNDER",
    },
  });
  await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      email: "ops@brand95.example",
      name: "Operator",
      role: "OPERATOR",
    },
  });

  // ---------- Camera95 ----------
  const { brand: camera95 } = await createBrandWithBlueprint({
    workspaceId: workspace.id,
    createdById: founder.id,
    name: "Camera95",
    concept:
      "Disposable cameras and memory products that help people capture memories without their phone.",
    problem:
      "Phone photos disappear into camera rolls; moments are experienced through screens.",
    customerHypothesis:
      "Gift-buyers, event hosts, and 18-30s who want tangible, screen-free memories.",
    geography: "Benelux first, then EU",
    priceRange: "€19–€35 retail",
    convictionStatement:
      "Analog memory products are a growing countertrend with strong gifting and event use cases.",
    channelHypothesis:
      "Dual validation with strong retail focus: concept stores, museum shops, gift shops, surf shops, bookstores.",
    preferredChannel: "DUAL_VALIDATION",
    startingBudget: "€15,000",
    maxInventoryExposure: "€8,000",
    founderHoursPerWeek: 15,
  });

  // Pass the Intake gate: criteria met, Level 3 approval requested and granted.
  const stage0Gate = await gateOf(camera95.id, 0);
  for (const c of stage0Gate.criteria) {
    await setCriterionStatus({
      criterionId: c.id,
      status: "MET",
      actorId: founder.id,
    });
  }
  const { request } = await requestGateApproval({
    gateId: stage0Gate.id,
    requestedBy: founder.id,
    whyNow: "Intake complete; founder ready to commit research time to Discover.",
  });
  await decideApproval({
    requestId: request.id,
    deciderId: founder.id,
    outcome: "APPROVED",
    note: "Research spend approved: 2 weeks, cap €500 out-of-pocket.",
  });

  // Route decision (spec §14: Camera95-like products default to dual).
  await prisma.brand.update({
    where: { id: camera95.id },
    data: { route: "DUAL" },
  });
  await prisma.decision.create({
    data: {
      brandId: camera95.id,
      title: "Validation route: dual",
      outcome: "ROUTE_DUAL",
      rationale:
        "Impulse-friendly, display-driven product with workable wholesale economics, and consumer proof still matters — build D2C foundation while pre-selling selected retailers.",
      decidedById: founder.id,
    },
  });

  // Discover evidence so far (partial — gate intentionally not ready).
  const discoverGate = await gateOf(camera95.id, 1);
  const customerProblem = discoverGate.criteria.find(
    (c) => c.key === "clear_customer_problem",
  )!;
  const differentiation = discoverGate.criteria.find(
    (c) => c.key === "plausible_differentiation",
  )!;
  const signals: [string, string][] = [
    ["Reddit r/AnalogCommunity thread on event disposables", "132 upvotes; recurring 'wedding table camera' use case"],
    ["Interview: Amsterdam concept-store buyer", "Stocks two disposable brands; both sell out summer weekends"],
    ["Interview: wedding planner (Utrecht)", "Books disposable-camera table sets for ~40% of weddings"],
    ["TikTok trend scan #disposablecamera", "2.1B views; gifting framing dominates"],
    ["Interview: museum shop manager (Rotterdam)", "Wants exclusive artwork editions, margin ≥ 55%"],
    ["Survey pilot n=41 via event-photography newsletter", "63% bought a disposable in the last 12 months"],
  ];
  for (const [source, note] of signals) {
    await recordEvidence({
      criterionId: customerProblem.id,
      type: source.startsWith("Interview") ? "INTERVIEW" : "CUSTOMER_SIGNAL",
      source,
      note,
      recordedBy: founder.id,
    });
  }
  await recordEvidence({
    criterionId: differentiation.id,
    type: "DOCUMENT",
    source: "Competitor map v1 (Kodak, Fujifilm, Lomography, 3 white-label EU brands)",
    note: "No competitor owns the 'memory product' gifting position in EU concept retail.",
    recordedBy: founder.id,
  });

  // Discover research tasks (Opportunity Research workflow §8.2, parallel).
  const discoverStage = await prisma.brandStage.findUniqueOrThrow({
    where: { brandId_index: { brandId: camera95.id, index: 1 } },
  });
  const researchTasks: [string, string][] = [
    ["Customer problem and jobs-to-be-done research", "research"],
    ["Competitor and price-architecture research", "research"],
    ["Retail landscape: Benelux concept/gift/museum channels", "retail"],
    ["Product feasibility and supplier scan", "product"],
    ["Initial unit economics (low/base/high)", "finance"],
  ];
  for (const [title, agent] of researchTasks) {
    await prisma.task.create({
      data: {
        brandId: camera95.id,
        stageId: discoverStage.id,
        title,
        assigneeAgent: agent,
        status: agent === "research" ? "IN_PROGRESS" : "TODO",
      },
    });
  }

  // Opportunity Memo draft artifact.
  const memo = await prisma.artifact.create({
    data: {
      workspaceId: workspace.id,
      brandId: camera95.id,
      title: "Camera95 Opportunity Memo",
      kind: "opportunity_memo",
      versions: {
        create: {
          version: 1,
          format: "markdown",
          createdBy: "research",
          content: [
            "# Camera95 Opportunity Memo (draft v1)",
            "",
            "**Recommendation:** proceed to validation (dual route).",
            "",
            "## Facts",
            "- 6 customer signals recorded, 3 from direct interviews.",
            "- Two Benelux buyers report sell-through on existing disposables.",
            "",
            "## Estimates",
            "- Landed cost €6.20–€7.80 at 1k units (white-label, EU artwork).",
            "- Retail €24.95 supports ≥55% retail margin at €11 wholesale.",
            "",
            "## Hypotheses",
            "- Exclusive artwork editions unlock museum/concept placement.",
            "",
            "## Open questions",
            "- Lab-development partner economics for the 'memories back' loop.",
          ].join("\n"),
        },
      },
    },
  });

  // Example agent runs with schema-validated payloads.
  const handoff = agentHandoffSchema.parse({
    handoff_id: randomUUID(),
    brand_id: camera95.id,
    from_agent: "ceo_orchestrator",
    to_agent: "research",
    objective: "Deliver Discover research pack for Camera95",
    inputs: [{ type: "artifact", id: memo.id, version: 1 }],
    constraints: ["Benelux first", "Retail margin ≥ 55% at €24.95 RRP"],
    required_outputs: ["customer_signals", "competitor_map", "price_architecture"],
    acceptance_criteria: ["≥15 customer signals", "≥10 competitors reviewed"],
    due_at: null,
    created_at: new Date().toISOString(),
    status: "in_progress",
  });
  await prisma.agentRun.create({
    data: {
      brandId: camera95.id,
      agentKey: "research",
      status: "RUNNING",
      objective: handoff.objective,
      handoff,
      startedAt: new Date(),
    },
  });
  const retailResult = agentResultSchema.parse({
    task_id: randomUUID(),
    agent: "retail",
    status: "completed",
    summary:
      "Scanned 42 Benelux concept/gift/museum stores; 18 look high-fit for Camera95.",
    outputs: [{ type: "text", id: "retail-scan-notes" }],
    evidence: ["Store list with fit notes (18 high-fit of 42 scanned)"],
    assumptions: ["Fit scoring based on public assortment only"],
    risks: ["Museum shops have 6–9 month buying cycles"],
    decisions_required: [],
    next_recommended_action:
      "Enrich the 18 high-fit prospects and prepare fit scores for Retail Validation.",
    completed_at: new Date().toISOString(),
  });
  await prisma.agentRun.create({
    data: {
      brandId: camera95.id,
      agentKey: "retail",
      status: "COMPLETED",
      objective: "Initial Benelux retail landscape scan",
      result: retailResult,
      startedAt: new Date(Date.now() - 3600_000),
      completedAt: new Date(),
    },
  });

  // ---------- Crossbody ----------
  const { brand: crossbody } = await createBrandWithBlueprint({
    workspaceId: workspace.id,
    createdById: founder.id,
    name: "Crossbody",
    concept: "Bold, convenient urban carry: crossbody bags and accessories.",
    customerHypothesis: "Urban 20-35s who want hands-free carry with attitude.",
    geography: "NL + DE metros",
    priceRange: "€39–€79 retail",
    channelHypothesis:
      "D2C creative validation plus selected fashion retail: boutiques, sneaker stores, concept stores.",
    preferredChannel: "D2C_FIRST",
  });
  const crossbodyGate = await gateOf(crossbody.id, 0);
  for (const c of crossbodyGate.criteria) {
    await setCriterionStatus({
      criterionId: c.id,
      status: "MET",
      actorId: founder.id,
    });
  }
  // Pending Level 3 request — shows up in the approval inbox.
  await requestGateApproval({
    gateId: crossbodyGate.id,
    requestedBy: "ceo_orchestrator",
    whyNow: "Intake complete; requesting research spend approval for Discover.",
  });

  // ---------- Standard Dental (parked) ----------
  const { brand: dental } = await createBrandWithBlueprint({
    workspaceId: workspace.id,
    createdById: founder.id,
    name: "Standard Dental",
    concept: "Premium oral care: elevate everyday oral-care tools.",
    customerHypothesis: "Design-conscious adults upgrading bathroom staples.",
    geography: "EU",
    priceRange: "€9–€29 retail",
    channelHypothesis:
      "Expert credibility plus premium retail: design stores, wellness stores, apothecaries, premium gifting.",
    preferredChannel: "RETAIL_FIRST",
  });
  await prisma.brand.update({
    where: { id: dental.id },
    data: { status: "PARKED" },
  });
  await prisma.decision.create({
    data: {
      brandId: dental.id,
      title: "Park Standard Dental",
      outcome: "PARK",
      rationale:
        "Portfolio discipline: one validation project at a time — Camera95 is in Discover.",
      decidedById: founder.id,
    },
  });
  await prisma.event.create({
    data: {
      workspaceId: workspace.id,
      brandId: dental.id,
      actorType: "USER",
      actorId: founder.id,
      verb: "brand.parked",
      entityType: "Brand",
      entityId: dental.id,
      payload: { reason: "Portfolio discipline" },
    },
  });

  // ---------- Hold ----------
  await createBrandWithBlueprint({
    workspaceId: workspace.id,
    createdById: founder.id,
    name: "Hold",
    concept: "Tight premium boxers with witty branding; underwear and loungewear.",
    customerHypothesis: "Men 25-40 buying premium basics; strong gifting angle.",
    geography: "NL",
    priceRange: "€24–€34 per pair",
    channelHypothesis:
      "D2C-first creative and fit validation, then selective menswear boutiques and lifestyle stores.",
    preferredChannel: "D2C_FIRST",
  });

  const counts = {
    brands: await prisma.brand.count(),
    stages: await prisma.brandStage.count(),
    criteria: await prisma.gateCriterion.count(),
    tasks: await prisma.task.count(),
    approvals: await prisma.approvalRequest.count(),
    events: await prisma.event.count(),
  };
  console.log("Seed complete:", counts);
}

async function gateOf(brandId: string, stageIndex: number) {
  const stage = await prisma.brandStage.findUniqueOrThrow({
    where: { brandId_index: { brandId, index: stageIndex } },
  });
  const gate = await prisma.stageGate.findUniqueOrThrow({
    where: { stageId: stage.id },
    include: { criteria: true },
  });
  // Sanity: criteria must match the blueprint definition.
  const def = getStage(stageIndex);
  if (gate.criteria.length !== def.gateCriteria.length) {
    throw new Error(`Gate criteria mismatch for stage ${stageIndex}`);
  }
  return gate;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
