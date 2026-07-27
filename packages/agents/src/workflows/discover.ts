import { randomUUID } from "node:crypto";
import { prisma, type Brand } from "@brand95/database";
import {
  agentHandoffSchema,
  agentResultSchema,
  type AgentKey,
} from "@brand95/domain";
import { generateStructured, llmMode } from "../llm";
import { mockOpportunityMemo, mockSpecialistOutput } from "../mock";
import {
  opportunityMemoSchema,
  specialistOutputSchema,
  type SpecialistOutput,
} from "../output-schemas";
import { brandBrief, systemPromptFor } from "../prompts";

/**
 * Opportunity Research workflow (spec §8.2).
 *
 * The CEO Orchestrator spawns Research, Retail, Product, and Finance agents in
 * parallel, saves each deliverable as a versioned artifact, attaches the
 * outputs as evidence on the Discover gate criteria, and consolidates
 * everything into the Opportunity Memo with a proceed/revise/park/reject
 * recommendation. Nothing here approves anything: the founder decides on the
 * Blueprint tab, exactly as before.
 *
 * Idempotency: refuses to start while a Discover orchestration for the brand
 * is still RUNNING (stale runs older than 30 minutes are marked FAILED).
 */

interface SpecialistPlan {
  key: AgentKey;
  objective: string;
  artifactKind: string;
  /** Discover gate criteria this deliverable evidences. */
  criteria: string[];
}

const SPECIALISTS: SpecialistPlan[] = [
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
];

const STALE_RUN_MS = 30 * 60 * 1000;

export async function runDiscoverResearch(input: {
  brandId: string;
  requestedBy: string; // user id
}) {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: input.brandId },
  });
  if (brand.status !== "ACTIVE") {
    throw new Error(`Brand is ${brand.status}; reactivate it first.`);
  }
  if (brand.currentStageIndex !== 1) {
    throw new Error(
      "Discover research runs in Stage 1 (Discover). Advance the brand through the Intake gate first.",
    );
  }

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
      throw new Error("A Discover research run is already in progress.");
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
      objective: `Discover research orchestration for ${brand.name}`,
      startedAt: new Date(),
    },
  });
  await logEvent(brand, input.requestedBy, "agent.run_started", "AgentRun", ceoRun.id, {
    agent: "ceo_orchestrator",
    mode: llmMode(),
  });

  // Spawn the specialists in parallel.
  const settled = await Promise.allSettled(
    SPECIALISTS.map((plan) => runSpecialist(brand, plan, input.requestedBy)),
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
    throw new Error(`Discover research failed: ${message}`);
  }

  // CEO consolidation into the Opportunity Memo.
  const memo = await generateStructured({
    system: systemPromptFor("ceo_orchestrator"),
    schema: opportunityMemoSchema,
    mock: () => mockOpportunityMemo(brand),
    maxTokens: 16000,
    prompt: `${brandBrief(brand)}

Consolidate the following specialist deliverables into the Opportunity Memo
and recommend proceed, revise, park, or reject.

${successes
  .map(
    (s) => `--- ${s.plan.key.toUpperCase()} ---\n${s.output.artifact_markdown.slice(0, 6000)}`,
  )
  .join("\n\n")}
${failures.length > 0 ? `\nNote: ${failures.length} specialist run(s) failed and produced no deliverable.` : ""}`,
  });

  const memoArtifact = await upsertArtifact(brand, {
    title: `${brand.name} Opportunity Memo`,
    kind: "opportunity_memo",
    markdown: memo.memo_markdown,
    createdBy: "ceo_orchestrator",
  });

  const ceoResult = agentResultSchema.parse({
    task_id: randomUUID(),
    agent: "ceo_orchestrator",
    status: "completed",
    summary: `${memo.summary} Recommendation: ${memo.recommendation.toUpperCase()} — ${memo.recommendation_rationale}`,
    outputs: [{ type: "artifact", id: memoArtifact.id }],
    evidence: successes.map((s) => `${s.plan.key}: ${s.output.summary}`),
    assumptions: [],
    risks: memo.missing_evidence.map((m) => `Missing evidence: ${m}`),
    decisions_required: [
      {
        type: "approval",
        question: `Opportunity Memo recommends "${memo.recommendation}". Review evidence and decide on the Discover gate.`,
      },
    ],
    next_recommended_action: memo.next_recommended_action,
    completed_at: new Date().toISOString(),
  });

  await prisma.agentRun.update({
    where: { id: ceoRun.id },
    data: { status: "COMPLETED", result: ceoResult, completedAt: new Date() },
  });
  await logEvent(brand, input.requestedBy, "agent.run_completed", "AgentRun", ceoRun.id, {
    agent: "ceo_orchestrator",
    recommendation: memo.recommendation,
    specialists_succeeded: successes.length,
    specialists_failed: failures.length,
  });

  return {
    recommendation: memo.recommendation,
    memoArtifactId: memoArtifact.id,
    specialistsSucceeded: successes.length,
    specialistsFailed: failures.length,
  };
}

interface SpecialistRunResult {
  plan: SpecialistPlan;
  output: SpecialistOutput;
}

async function runSpecialist(
  brand: Brand,
  plan: SpecialistPlan,
  actorId: string,
): Promise<SpecialistRunResult> {
  const handoff = agentHandoffSchema.parse({
    handoff_id: randomUUID(),
    brand_id: brand.id,
    from_agent: "ceo_orchestrator",
    to_agent: plan.key,
    objective: plan.objective,
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
      agentKey: plan.key,
      status: "RUNNING",
      objective: plan.objective,
      handoff,
      startedAt: new Date(),
    },
  });

  try {
    const output = await generateStructured({
      system: systemPromptFor(plan.key),
      schema: specialistOutputSchema,
      mock: () => mockSpecialistOutput(plan.key, brand),
      maxTokens: 16000,
      prompt: `${brandBrief(brand)}

Task: ${plan.objective}. Produce the full deliverable as markdown.`,
    });

    const artifact = await upsertArtifact(brand, {
      title: output.artifact_title,
      kind: plan.artifactKind,
      markdown: output.artifact_markdown,
      createdBy: plan.key,
    });

    // Attach the deliverable as evidence on the mapped Discover criteria.
    const criteria = await prisma.gateCriterion.findMany({
      where: {
        key: { in: plan.criteria },
        gate: { stage: { brandId: brand.id, index: 1 } },
      },
    });
    for (const criterion of criteria) {
      await prisma.gateEvidence.create({
        data: {
          criterionId: criterion.id,
          type: "DOCUMENT",
          source: output.artifact_title,
          note: output.summary,
          recordedBy: plan.key,
        },
      });
    }

    // Close out the matching seeded Discover task, if one exists.
    await prisma.task.updateMany({
      where: {
        brandId: brand.id,
        assigneeAgent: plan.key,
        status: { in: ["TODO", "IN_PROGRESS"] },
        stage: { index: 1 },
      },
      data: { status: "DONE" },
    });

    const result = agentResultSchema.parse({
      task_id: randomUUID(),
      agent: plan.key,
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
      agent: plan.key,
      artifactId: artifact.id,
    });

    return { plan, output };
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
      agent: plan.key,
    });
    throw err;
  }
}

async function upsertArtifact(
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
