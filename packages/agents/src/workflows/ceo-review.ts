import { randomUUID } from "node:crypto";
import { prisma } from "@brand95/database";
import { agentResultSchema, getStage } from "@brand95/domain";
import { generateStructured } from "../llm";
import { mockCeoReview } from "../mock";
import { ceoReviewSchema } from "../output-schemas";
import { systemPromptFor } from "../prompts";

/**
 * Weekly CEO Review workflow (spec §8.8): refresh portfolio state, identify
 * the biggest bottleneck per active brand, review overdue approvals and open
 * risks, and produce a founder briefing with at most three priorities per
 * brand. Stored as a workspace-level versioned artifact.
 */
export async function runWeeklyCeoReview(input: {
  workspaceId: string;
  requestedBy: string; // user id
}) {
  const brands = await prisma.brand.findMany({
    where: { workspaceId: input.workspaceId },
    include: {
      stages: { include: { gate: { include: { criteria: true } } } },
      tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } },
      risks: { where: { status: "OPEN" } },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  const pendingApprovals = await prisma.approvalRequest.findMany({
    where: { workspaceId: input.workspaceId, status: "PENDING" },
    include: { brand: true },
  });

  const portfolioState = brands
    .map((b) => {
      const stageDef = getStage(b.currentStageIndex);
      const currentStage = b.stages.find((s) => s.index === b.currentStageIndex);
      const gate = currentStage?.gate;
      const met = gate?.criteria.filter((c) => c.status !== "PENDING").length ?? 0;
      return [
        `## ${b.name} (${b.status})`,
        `Stage ${b.currentStageIndex}: ${stageDef.name}; gate ${gate?.status ?? "?"} (${met}/${gate?.criteria.length ?? 0} criteria met)`,
        `Open tasks: ${b.tasks.length}; open risks: ${b.risks.map((r) => `${r.severity} ${r.title}`).join("; ") || "none"}`,
        `Recent agent runs: ${b.agentRuns.map((r) => `${r.agentKey} ${r.status}`).join(", ") || "none"}`,
      ].join("\n");
    })
    .join("\n\n");

  const run = await prisma.agentRun.create({
    data: {
      agentKey: "ceo_orchestrator",
      status: "RUNNING",
      objective: "Weekly CEO review",
      startedAt: new Date(),
    },
  });

  try {
    const review = await generateStructured({
      system: systemPromptFor("ceo_orchestrator"),
      schema: ceoReviewSchema,
      mock: () => mockCeoReview(),
      maxTokens: 16000,
      prompt: `Produce the Weekly CEO Review for the Brand95 portfolio.

Rules: identify the single biggest bottleneck per active brand, recommend at
most three priorities per brand, flag overdue approvals, and call out
portfolio-discipline problems (more than one active build, or more than one
validation project).

Portfolio state:

${portfolioState || "No brands yet."}

Pending approvals (${pendingApprovals.length}):
${pendingApprovals
  .map((r) => {
    const c = r.content as { proposedAction?: string };
    return `- [L${r.level}] ${r.brand?.name ?? "portfolio"}: ${c.proposedAction ?? r.actionType} (since ${r.createdAt.toISOString().slice(0, 10)})`;
  })
  .join("\n") || "- none"}`,
    });

    // Workspace-level artifact (no brand), versioned on each run.
    const existing = await prisma.artifact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        brandId: null,
        title: "Weekly CEO Review",
      },
    });
    let artifact;
    if (existing) {
      const version = existing.currentVersion + 1;
      await prisma.artifactVersion.create({
        data: {
          artifactId: existing.id,
          version,
          format: "markdown",
          content: review.briefing_markdown,
          createdBy: "ceo_orchestrator",
        },
      });
      artifact = await prisma.artifact.update({
        where: { id: existing.id },
        data: { currentVersion: version },
      });
    } else {
      artifact = await prisma.artifact.create({
        data: {
          workspaceId: input.workspaceId,
          title: "Weekly CEO Review",
          kind: "ceo_review",
          versions: {
            create: {
              version: 1,
              format: "markdown",
              content: review.briefing_markdown,
              createdBy: "ceo_orchestrator",
            },
          },
        },
      });
    }

    const result = agentResultSchema.parse({
      task_id: randomUUID(),
      agent: "ceo_orchestrator",
      status: "completed",
      summary: review.summary,
      outputs: [{ type: "artifact", id: artifact.id }],
      evidence: [],
      assumptions: [],
      risks: [],
      decisions_required: [],
      next_recommended_action: review.next_recommended_action,
      completed_at: new Date().toISOString(),
    });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", result, completedAt: new Date() },
    });
    await prisma.event.create({
      data: {
        workspaceId: input.workspaceId,
        actorType: "AGENT",
        actorId: input.requestedBy,
        verb: "ceo_review.generated",
        entityType: "Artifact",
        entityId: artifact.id,
        payload: { version: artifact.currentVersion },
      },
    });

    return { artifactId: artifact.id, version: artifact.currentVersion };
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}
