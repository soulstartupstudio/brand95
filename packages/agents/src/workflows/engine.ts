import { randomUUID } from "node:crypto";
import { prisma, type Brand } from "@brand95/database";
import {
  agentHandoffSchema,
  agentResultSchema,
  getStage,
  type AgentKey,
} from "@brand95/domain";
import { generateStructured, llmMode } from "../llm";
import { mockSpecialistOutput, mockStageReport } from "../mock";
import {
  specialistOutputSchema,
  stageReportSchema,
  type SpecialistOutput,
} from "../output-schemas";
import { brandBrief, systemPromptFor } from "../prompts";

/**
 * Stage-aware agent engine. Every blueprint stage from Discover onward has a
 * plan: which specialists run in parallel, what each delivers, and which gate
 * criteria the deliverable evidences. The CEO Orchestrator consolidates the
 * results into one stage document with a proceed/revise/park/reject
 * recommendation. Founder decisions (criteria, gates) stay exactly where they
 * were — agents prepare, humans decide.
 */

export interface StageSpecialist {
  key: AgentKey;
  objective: string;
  artifactKind: string;
  /** Gate criteria of this stage that the deliverable evidences. */
  criteria: string[];
}

export interface StagePlan {
  stageIndex: number;
  specialists: StageSpecialist[];
  consolidatedTitle: (brandName: string) => string;
  consolidatedKind: string;
  consolidationInstruction: string;
}

export const STAGE_PLANS: Record<number, StagePlan> = {
  1: {
    stageIndex: 1,
    specialists: [
      {
        key: "research",
        objective: "Customer, category, and competitor research pack",
        artifactKind: "research_pack",
        criteria: ["clear_customer_problem", "plausible_differentiation"],
      },
      {
        key: "retail",
        objective: "Retail landscape scan and channel assessment",
        artifactKind: "retail_scan",
        criteria: ["clear_customer_problem"],
      },
      {
        key: "product",
        objective: "Product feasibility and supplier landscape brief",
        artifactKind: "product_feasibility",
        criteria: ["no_fatal_blocker"],
      },
      {
        key: "finance",
        objective: "Initial unit economics with low/base/high scenarios",
        artifactKind: "unit_economics",
        criteria: ["plausible_gross_margin"],
      },
    ],
    consolidatedTitle: (b) => `${b} Opportunity Memo`,
    consolidatedKind: "opportunity_memo",
    consolidationInstruction:
      "Consolidate into the Opportunity Memo: opportunity, customer, competition, price architecture, unit economics, retail landscape, risks.",
  },
  2: {
    stageIndex: 2,
    specialists: [
      {
        key: "growth",
        objective:
          "Validation experiment plan: landing page/waitlist/pre-order design with measurable targets",
        artifactKind: "validation_plan",
        criteria: ["behavioral_evidence"],
      },
      {
        key: "research",
        objective:
          "Interview guide and customer-signal tracking framework for validation",
        artifactKind: "interview_guide",
        criteria: ["customer_clarity"],
      },
      {
        key: "retail",
        objective:
          "Retailer line-sheet test plan and buyer interview approach",
        artifactKind: "retail_test_plan",
        criteria: ["channel_traction"],
      },
      {
        key: "finance",
        objective: "Pricing test design and price-resistance analysis",
        artifactKind: "pricing_test",
        criteria: ["price_resistance_understood"],
      },
    ],
    consolidatedTitle: (b) => `${b} Validation Plan & Report`,
    consolidatedKind: "validation_report",
    consolidationInstruction:
      "Consolidate into one validation plan and report: chosen validation methods, measurable targets, evidence collected so far, and what behavioral proof is still needed before committing build cost.",
  },
  3: {
    stageIndex: 3,
    specialists: [
      {
        key: "brand_builder",
        objective:
          "Three materially distinct positioning routes, naming routes, brand story, and messaging hierarchy",
        artifactKind: "positioning_routes",
        criteria: ["brand_system_approved"],
      },
      {
        key: "creative_studio",
        objective:
          "Visual identity brief: palette, typography, logo system direction, packaging architecture",
        artifactKind: "visual_identity_brief",
        criteria: ["production_files_ready"],
      },
      {
        key: "research",
        objective:
          "Name availability and claims/legal check plan (trademarks, domains, claims constraints)",
        artifactKind: "legal_check_plan",
        criteria: ["legal_checks_logged"],
      },
      {
        key: "growth",
        objective:
          "Tone of voice and the Brand95 five-second/five-metre quality test assessment",
        artifactKind: "tone_quality_test",
        criteria: ["quality_test"],
      },
    ],
    consolidatedTitle: (b) => `${b} Brand Book Draft`,
    consolidatedKind: "brand_book",
    consolidationInstruction:
      "Consolidate into a brand book draft: recommended positioning route with rationale, name shortlist, story, messaging, tone, and visual direction — flagging every legal check still open.",
  },
  4: {
    stageIndex: 4,
    specialists: [
      {
        key: "product",
        objective:
          "Product requirements document, specifications, and supplier shortlist with sampling plan",
        artifactKind: "prd",
        criteria: ["golden_sample_approved"],
      },
      {
        key: "operations",
        objective: "Production plan and QC checklist",
        artifactKind: "production_qc_plan",
        criteria: ["production_qc_approved"],
      },
      {
        key: "finance",
        objective:
          "Costing by volume tier and landed-cost model (freight, duties, packaging, fees, returns, fulfilment)",
        artifactKind: "landed_cost_model",
        criteria: ["landed_cost_verified"],
      },
      {
        key: "retail",
        objective:
          "Wholesale and retail price architecture with minimum-viable-order rationale",
        artifactKind: "price_architecture",
        criteria: ["mvo_supported"],
      },
    ],
    consolidatedTitle: (b) => `${b} Production Approval Pack`,
    consolidatedKind: "production_pack",
    consolidationInstruction:
      "Consolidate into a production approval pack the founder can decide on: what to produce, with whom, at what landed cost and margin, at what order size, and what could go wrong. Production spend itself always remains a founder-only approval.",
  },
  5: {
    stageIndex: 5,
    specialists: [
      {
        key: "creative_studio",
        objective:
          "Product detail page content and launch asset requirements (product + lifestyle)",
        artifactKind: "pdp_content",
        criteria: ["no_placeholders"],
      },
      {
        key: "growth",
        objective:
          "Analytics/event tracking plan, email capture, and core lifecycle email outlines",
        artifactKind: "analytics_lifecycle_plan",
        criteria: ["analytics_verified"],
      },
      {
        key: "operations",
        objective:
          "Checkout, shipping, returns policy design and end-to-end + mobile QA checklist",
        artifactKind: "store_ops_qa",
        criteria: ["e2e_order_succeeds", "mobile_qa_passes"],
      },
      {
        key: "finance",
        objective: "Final pricing and policies review (shipping, returns, payments)",
        artifactKind: "pricing_policies",
        criteria: ["policies_pricing_approved"],
      },
    ],
    consolidatedTitle: (b) => `${b} Launch Readiness Report`,
    consolidatedKind: "launch_readiness",
    consolidationInstruction:
      "Consolidate into a launch readiness report: what is live, what was tested, what is still placeholder, and whether the store is genuinely purchasable and credible.",
  },
  6: {
    stageIndex: 6,
    specialists: [
      {
        key: "growth",
        objective:
          "Launch plan: channels, content pillars, creator list, and first-100-customers acquisition experiments",
        artifactKind: "launch_plan",
        criteria: ["acquisition_promise"],
      },
      {
        key: "customer_support",
        objective:
          "Support setup: FAQ, reply templates, returns triage, voice-of-customer loop",
        artifactKind: "support_setup",
        criteria: ["quality_acceptable"],
      },
      {
        key: "finance",
        objective:
          "Contribution margin measurement plan per order and per channel",
        artifactKind: "contribution_tracking",
        criteria: ["contribution_measured"],
      },
      {
        key: "research",
        objective:
          "Learning plan: source-of-purchase, objections, review and UGC capture toward the 100-customer targets",
        artifactKind: "learning_plan",
        criteria: ["hundred_customers"],
      },
    ],
    consolidatedTitle: (b) => `${b} Launch Report`,
    consolidatedKind: "launch_report",
    consolidationInstruction:
      "Consolidate into a launch report: progress toward 100 paying customers, what each channel is teaching, quality signals, and contribution economics.",
  },
  7: {
    stageIndex: 7,
    specialists: [
      {
        key: "retail",
        objective:
          "Line sheet, terms/MOQ, retail sample kit plan, and prospect pipeline strategy toward 50 contacted / 10 stockists",
        artifactKind: "retail_pipeline_pack",
        criteria: ["active_stockists"],
      },
      {
        key: "operations",
        objective: "Wholesale fulfilment and account support design",
        artifactKind: "wholesale_fulfilment",
        criteria: ["fulfilment_reliable"],
      },
      {
        key: "finance",
        objective: "Wholesale unit economics and reorder profitability",
        artifactKind: "wholesale_economics",
        criteria: ["wholesale_economics"],
      },
      {
        key: "growth",
        objective:
          "Sell-through support plan: display, reorder triggers, retailer marketing kit",
        artifactKind: "sellthrough_plan",
        criteria: ["reorder_signal"],
      },
    ],
    consolidatedTitle: (b) => `${b} Retail Validation Pack`,
    consolidatedKind: "retail_pack",
    consolidationInstruction:
      "Consolidate into a retail validation pack: pipeline state versus the 50/10/3 targets, wholesale economics, and what makes reorders likely.",
  },
  8: {
    stageIndex: 8,
    specialists: [
      {
        key: "growth",
        objective:
          "Channel repeatability analysis: CAC/payback where measurable, experiment velocity, next bets",
        artifactKind: "growth_engine",
        criteria: ["repeatable_channel"],
      },
      {
        key: "finance",
        objective:
          "Contribution margin by channel, cash runway, and scaling-spend scenario analysis",
        artifactKind: "channel_economics",
        criteria: ["positive_contribution", "scaling_spend_approved"],
      },
      {
        key: "operations",
        objective: "Inventory cover, forecast cadence, and cash planning controls",
        artifactKind: "inventory_controls",
        criteria: ["inventory_cash_controlled"],
      },
    ],
    consolidatedTitle: (b) => `${b} Growth Engine Review`,
    consolidatedKind: "growth_review",
    consolidationInstruction:
      "Consolidate into a growth engine review: which channel is repeatable, the contribution picture, and whether scaling spend is justified.",
  },
  9: {
    stageIndex: 9,
    specialists: [
      {
        key: "product",
        objective:
          "Mini opportunity memos for candidate SKUs that strengthen the same audience/occasion/distribution",
        artifactKind: "sku_memos",
        criteria: ["viable_skus"],
      },
      {
        key: "finance",
        objective: "Per-SKU unit economics and assortment profitability",
        artifactKind: "sku_economics",
        criteria: ["viable_skus"],
      },
      {
        key: "operations",
        objective: "Inventory complexity assessment for the proposed assortment",
        artifactKind: "assortment_complexity",
        criteria: ["inventory_complexity"],
      },
      {
        key: "growth",
        objective: "Cross-sell and repeat-behavior analysis",
        artifactKind: "cross_sell_analysis",
        criteria: ["cross_sell_proven"],
      },
    ],
    consolidatedTitle: (b) => `${b} Ecosystem Plan`,
    consolidatedKind: "ecosystem_plan",
    consolidationInstruction:
      "Consolidate into an ecosystem plan: which SKUs to add, in what order, with what economics — and where assortment bloat starts.",
  },
  10: {
    stageIndex: 10,
    specialists: [
      {
        key: "operations",
        objective:
          "SOP library outline, role ownership map, automation coverage map, and risk register refresh",
        artifactKind: "sop_automation_map",
        criteria: ["owned_processes", "exceptions_visible"],
      },
      {
        key: "customer_support",
        objective: "Customer support standards and escalation playbook",
        artifactKind: "support_standards",
        criteria: ["owned_processes"],
      },
      {
        key: "finance",
        objective: "Annual brand plan: forecast, budget, and KPI dashboard spec",
        artifactKind: "annual_plan",
        criteria: ["founder_free_month"],
      },
    ],
    consolidatedTitle: (b) => `${b} Systemize & Scale Plan`,
    consolidatedKind: "systemize_plan",
    consolidationInstruction:
      "Consolidate into a systemize-and-scale plan: what must be true for the brand to run four founder-free weeks, who owns what, and the fallbacks.",
  },
};

const STALE_RUN_MS = 30 * 60 * 1000;

export async function runStageAgents(input: {
  brandId: string;
  requestedBy: string; // user id
}) {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: input.brandId },
  });
  if (brand.status !== "ACTIVE") {
    throw new Error(`Brand is ${brand.status}; reactivate it first.`);
  }
  const plan = STAGE_PLANS[brand.currentStageIndex];
  if (!plan) {
    throw new Error(
      "Agents run from Stage 1 (Discover) onward. Complete the Intake gate first.",
    );
  }
  const stageDef = getStage(plan.stageIndex);

  // Idempotency guard against double-clicks and crashed runs.
  const running = await prisma.agentRun.findFirst({
    where: {
      brandId: brand.id,
      agentKey: "ceo_orchestrator",
      status: "RUNNING",
    },
  });
  if (running) {
    if (Date.now() - running.createdAt.getTime() < STALE_RUN_MS) {
      throw new Error("An orchestration run is already in progress for this brand.");
    }
    await prisma.agentRun.update({
      where: { id: running.id },
      data: { status: "FAILED", error: "Marked stale by a newer run." },
    });
  }

  const ceoRun = await prisma.agentRun.create({
    data: {
      brandId: brand.id,
      agentKey: "ceo_orchestrator",
      status: "RUNNING",
      objective: `${stageDef.name} orchestration for ${brand.name}`,
      startedAt: new Date(),
    },
  });
  await logEvent(brand, input.requestedBy, "agent.run_started", "AgentRun", ceoRun.id, {
    agent: "ceo_orchestrator",
    stage: stageDef.slug,
    mode: llmMode(),
  });

  const settled = await Promise.allSettled(
    plan.specialists.map((spec) =>
      runSpecialist(brand, plan, spec, input.requestedBy),
    ),
  );
  const successes = settled
    .filter(
      (r): r is PromiseFulfilledResult<SpecialistRunResult> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
  const failures = settled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );

  if (successes.length === 0) {
    const reason = failures[0]?.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    await prisma.agentRun.update({
      where: { id: ceoRun.id },
      data: { status: "FAILED", error: `All specialists failed: ${message}` },
    });
    throw new Error(`${stageDef.name} agents failed: ${message}`);
  }

  const title = plan.consolidatedTitle(brand.name);
  const report = await generateStructured({
    system: systemPromptFor("ceo_orchestrator"),
    schema: stageReportSchema,
    mock: () => mockStageReport(brand, title),
    maxTokens: 16000,
    prompt: `${brandBrief(brand)}

Current stage: ${plan.stageIndex} — ${stageDef.name} (${stageDef.purpose})
Gate criteria for this stage:
${stageDef.gateCriteria.map((c) => `- ${c.label}`).join("\n")}

${plan.consolidationInstruction}
Recommend proceed, revise, park, or reject for this stage.

Specialist deliverables:

${successes
  .map(
    (s) =>
      `--- ${s.spec.key.toUpperCase()} ---\n${s.output.artifact_markdown.slice(0, 6000)}`,
  )
  .join("\n\n")}
${failures.length > 0 ? `\nNote: ${failures.length} specialist run(s) failed and produced no deliverable.` : ""}`,
  });

  const reportArtifact = await upsertArtifact(brand, {
    title,
    kind: plan.consolidatedKind,
    markdown: report.report_markdown,
    createdBy: "ceo_orchestrator",
  });

  const ceoResult = agentResultSchema.parse({
    task_id: randomUUID(),
    agent: "ceo_orchestrator",
    status: "completed",
    summary: `${report.summary} Recommendation: ${report.recommendation.toUpperCase()} — ${report.recommendation_rationale}`,
    outputs: [{ type: "artifact", id: reportArtifact.id }],
    evidence: successes.map((s) => `${s.spec.key}: ${s.output.summary}`),
    assumptions: [],
    risks: report.missing_evidence.map((m) => `Missing evidence: ${m}`),
    decisions_required: [
      {
        type: "approval",
        question: `"${title}" recommends ${report.recommendation}. Review evidence and decide on the ${stageDef.name} gate.`,
      },
    ],
    next_recommended_action: report.next_recommended_action,
    completed_at: new Date().toISOString(),
  });

  await prisma.agentRun.update({
    where: { id: ceoRun.id },
    data: { status: "COMPLETED", result: ceoResult, completedAt: new Date() },
  });
  await logEvent(brand, input.requestedBy, "agent.run_completed", "AgentRun", ceoRun.id, {
    agent: "ceo_orchestrator",
    stage: stageDef.slug,
    recommendation: report.recommendation,
    specialists_succeeded: successes.length,
    specialists_failed: failures.length,
  });

  return {
    stageIndex: plan.stageIndex,
    stageName: stageDef.name,
    recommendation: report.recommendation,
    reportArtifactId: reportArtifact.id,
    specialistsSucceeded: successes.length,
    specialistsFailed: failures.length,
  };
}

interface SpecialistRunResult {
  spec: StageSpecialist;
  output: SpecialistOutput;
}

async function runSpecialist(
  brand: Brand,
  plan: StagePlan,
  spec: StageSpecialist,
  actorId: string,
): Promise<SpecialistRunResult> {
  const handoff = agentHandoffSchema.parse({
    handoff_id: randomUUID(),
    brand_id: brand.id,
    from_agent: "ceo_orchestrator",
    to_agent: spec.key,
    objective: spec.objective,
    inputs: [{ type: "text", id: "brand-brief" }],
    constraints: [brand.geography, brand.priceRange].filter(
      (x): x is string => !!x,
    ),
    required_outputs: ["artifact_markdown", "evidence", "risks"],
    acceptance_criteria: ["Facts, estimates, and hypotheses separated"],
    due_at: null,
    created_at: new Date().toISOString(),
    status: "in_progress",
  });

  const run = await prisma.agentRun.create({
    data: {
      brandId: brand.id,
      agentKey: spec.key,
      status: "RUNNING",
      objective: spec.objective,
      handoff,
      startedAt: new Date(),
    },
  });

  try {
    const output = await generateStructured({
      system: systemPromptFor(spec.key),
      schema: specialistOutputSchema,
      mock: () => mockSpecialistOutput(spec.key, brand),
      maxTokens: 16000,
      prompt: `${brandBrief(brand)}

Task: ${spec.objective}. Produce the full deliverable as markdown.`,
    });

    const artifact = await upsertArtifact(brand, {
      title: output.artifact_title,
      kind: spec.artifactKind,
      markdown: output.artifact_markdown,
      createdBy: spec.key,
    });

    const criteria = await prisma.gateCriterion.findMany({
      where: {
        key: { in: spec.criteria },
        gate: { stage: { brandId: brand.id, index: plan.stageIndex } },
      },
    });
    for (const criterion of criteria) {
      await prisma.gateEvidence.create({
        data: {
          criterionId: criterion.id,
          type: "DOCUMENT",
          source: output.artifact_title,
          note: output.summary,
          recordedBy: spec.key,
        },
      });
    }

    await prisma.task.updateMany({
      where: {
        brandId: brand.id,
        assigneeAgent: spec.key,
        status: { in: ["TODO", "IN_PROGRESS"] },
        stage: { index: plan.stageIndex },
      },
      data: { status: "DONE" },
    });

    const result = agentResultSchema.parse({
      task_id: randomUUID(),
      agent: spec.key,
      status: "completed",
      summary: output.summary,
      outputs: [{ type: "artifact", id: artifact.id }],
      evidence: output.evidence,
      assumptions: output.assumptions,
      risks: output.risks,
      decisions_required: [],
      next_recommended_action: output.next_recommended_action,
      completed_at: new Date().toISOString(),
    });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", result, completedAt: new Date() },
    });
    await logEvent(brand, actorId, "agent.run_completed", "AgentRun", run.id, {
      agent: spec.key,
      artifactId: artifact.id,
    });

    return { spec, output };
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    await logEvent(brand, actorId, "agent.run_failed", "AgentRun", run.id, {
      agent: spec.key,
    });
    throw err;
  }
}

export async function upsertArtifact(
  brand: Brand,
  input: { title: string; kind: string; markdown: string; createdBy: string },
) {
  const existing = await prisma.artifact.findFirst({
    where: { brandId: brand.id, title: input.title },
  });
  if (existing) {
    const version = existing.currentVersion + 1;
    await prisma.artifactVersion.create({
      data: {
        artifactId: existing.id,
        version,
        format: "markdown",
        content: input.markdown,
        createdBy: input.createdBy,
      },
    });
    return prisma.artifact.update({
      where: { id: existing.id },
      data: { currentVersion: version },
    });
  }
  return prisma.artifact.create({
    data: {
      workspaceId: brand.workspaceId,
      brandId: brand.id,
      title: input.title,
      kind: input.kind,
      versions: {
        create: {
          version: 1,
          format: "markdown",
          content: input.markdown,
          createdBy: input.createdBy,
        },
      },
    },
  });
}

async function logEvent(
  brand: Brand,
  actorId: string,
  verb: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
) {
  await prisma.event.create({
    data: {
      workspaceId: brand.workspaceId,
      brandId: brand.id,
      actorType: "AGENT",
      actorId,
      verb,
      entityType,
      entityId,
      payload: payload as object,
    },
  });
}
