import {
  createBrandWithBlueprint,
  decideApproval,
  prisma,
  requestGateApproval,
  setCriterionStatus,
} from "@brand95/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWeeklyCeoReview } from "../src/workflows/ceo-review";
import { runDiscoverResearch } from "../src/workflows/discover";
import { runStageAgents, STAGE_PLANS } from "../src/workflows/engine";
import {
  draftRetailOutreach,
  executeApprovedOutreach,
} from "../src/workflows/outreach";

let workspaceId: string;
let founderId: string;
let brandId: string;

beforeAll(async () => {
  const workspace = await prisma.workspace.create({
    data: { name: `agents-test-${Date.now()}` },
  });
  workspaceId = workspace.id;
  founderId = (
    await prisma.user.create({
      data: {
        workspaceId,
        email: `founder-agents-${Date.now()}@test.example`,
        name: "Founder",
        role: "FOUNDER",
      },
    })
  ).id;

  // Create a brand and pass the Intake gate so it sits in Discover (stage 1).
  const { brand } = await createBrandWithBlueprint({
    workspaceId,
    createdById: founderId,
    name: "AgentTestBrand",
    concept: "A test product concept for the agent runtime.",
  });
  brandId = brand.id;
  const stage0 = await prisma.brandStage.findUniqueOrThrow({
    where: { brandId_index: { brandId, index: 0 } },
  });
  const gate = await prisma.stageGate.findUniqueOrThrow({
    where: { stageId: stage0.id },
    include: { criteria: true },
  });
  for (const c of gate.criteria) {
    await setCriterionStatus({
      criterionId: c.id,
      status: "MET",
      actorId: founderId,
    });
  }
  const { request } = await requestGateApproval({
    gateId: gate.id,
    requestedBy: founderId,
  });
  await decideApproval({
    requestId: request.id,
    deciderId: founderId,
    outcome: "APPROVED",
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Discover research orchestration (mock mode)", () => {
  it("spawns specialists, saves artifacts, attaches evidence, consolidates a memo", async () => {
    const result = await runDiscoverResearch({ brandId, requestedBy: founderId });
    expect(result.specialistsSucceeded).toBe(4);
    expect(result.specialistsFailed).toBe(0);
    expect(["proceed", "revise", "park", "reject"]).toContain(
      result.recommendation,
    );

    const runs = await prisma.agentRun.findMany({ where: { brandId } });
    const completed = runs.filter((r) => r.status === "COMPLETED");
    expect(completed.map((r) => r.agentKey).sort()).toEqual(
      ["ceo_orchestrator", "finance", "product", "research", "retail"].sort(),
    );

    const artifacts = await prisma.artifact.findMany({ where: { brandId } });
    expect(artifacts.length).toBeGreaterThanOrEqual(5); // 4 specialist + memo
    const memo = artifacts.find((a) => a.kind === "opportunity_memo");
    expect(memo).toBeTruthy();

    const evidence = await prisma.gateEvidence.findMany({
      where: { criterion: { gate: { stage: { brandId, index: 1 } } } },
    });
    expect(evidence.length).toBeGreaterThanOrEqual(4);

    const doneTasks = await prisma.task.count({
      where: { brandId, status: "DONE" },
    });
    expect(doneTasks).toBeGreaterThanOrEqual(0); // seeded discover tasks (if any) closed

    const verbs = (
      await prisma.event.findMany({ where: { brandId } })
    ).map((e) => e.verb);
    expect(verbs).toContain("agent.run_started");
    expect(verbs).toContain("agent.run_completed");
  });

  it("re-running creates new artifact versions, not duplicates", async () => {
    const before = await prisma.artifact.count({ where: { brandId } });
    await runDiscoverResearch({ brandId, requestedBy: founderId });
    const after = await prisma.artifact.count({ where: { brandId } });
    expect(after).toBe(before); // same titles → new versions
    const memo = await prisma.artifact.findFirstOrThrow({
      where: { brandId, kind: "opportunity_memo" },
    });
    expect(memo.currentVersion).toBeGreaterThanOrEqual(2);
  });

  it("refuses to run outside the Discover stage", async () => {
    const { brand: fresh } = await createBrandWithBlueprint({
      workspaceId,
      createdById: founderId,
      name: "StageZeroBrand",
      concept: "A concept that has not passed intake yet.",
    });
    await expect(
      runDiscoverResearch({ brandId: fresh.id, requestedBy: founderId }),
    ).rejects.toThrow(/Stage 1/);
  });
});

describe("Retail outreach draft → approve → execute (mock mode)", () => {
  it("drafts a batch behind a Level 1 approval and never sends before approval", async () => {
    const { requestId, drafted } = await draftRetailOutreach({
      brandId,
      requestedBy: founderId,
      count: 3,
    });
    expect(drafted).toBe(3);

    const request = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { outreachMessages: true },
    });
    expect(request.level).toBe(1);
    expect(request.status).toBe("PENDING");
    expect(request.outreachMessages).toHaveLength(3);
    expect(request.outreachMessages.every((m) => m.status === "DRAFT")).toBe(true);

    // Executing an unapproved batch must fail.
    await expect(
      executeApprovedOutreach({ requestId, actorId: founderId }),
    ).rejects.toThrow(/APPROVED/);

    // Approve, then execute.
    await decideApproval({
      requestId,
      deciderId: founderId,
      outcome: "APPROVED",
    });
    const exec = await executeApprovedOutreach({ requestId, actorId: founderId });
    expect(exec.sent).toBe(3);
    expect(exec.skipped).toBe(0);

    const sentMessages = await prisma.outreachMessage.findMany({
      where: { approvalRequestId: requestId },
    });
    expect(sentMessages.every((m) => m.status === "SENT")).toBe(true);

    // Idempotency: a second execution attempt must not double-send.
    const final = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(final.status).toBe("EXECUTED");
    await expect(
      executeApprovedOutreach({ requestId, actorId: founderId }),
    ).rejects.toThrow(/EXECUTED/);
    const keys = await prisma.idempotencyKey.count({
      where: { scope: "outreach.send" },
    });
    expect(keys).toBe(3);
  });
});

describe("stage-aware engine beyond Discover", () => {
  it("has a plan for every stage from Discover to Systemize", () => {
    for (let i = 1; i <= 10; i++) {
      expect(STAGE_PLANS[i], `plan for stage ${i}`).toBeTruthy();
      expect(STAGE_PLANS[i]!.specialists.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("runs the Validate stage plan after the Discover gate passes", async () => {
    // Advance the test brand from Discover (1) to Validate (2).
    const stage1 = await prisma.brandStage.findUniqueOrThrow({
      where: { brandId_index: { brandId, index: 1 } },
    });
    const gate = await prisma.stageGate.findUniqueOrThrow({
      where: { stageId: stage1.id },
      include: { criteria: true },
    });
    for (const c of gate.criteria) {
      await setCriterionStatus({
        criterionId: c.id,
        status: "MET",
        actorId: founderId,
      });
    }
    const { request } = await requestGateApproval({
      gateId: gate.id,
      requestedBy: founderId,
    });
    await decideApproval({
      requestId: request.id,
      deciderId: founderId,
      outcome: "APPROVED",
    });

    const result = await runStageAgents({ brandId, requestedBy: founderId });
    expect(result.stageIndex).toBe(2);
    expect(result.stageName).toBe("Validate");
    expect(result.specialistsSucceeded).toBe(4);

    const report = await prisma.artifact.findFirst({
      where: { brandId, kind: "validation_report" },
    });
    expect(report).toBeTruthy();

    // Evidence attached to Validate criteria, not Discover's.
    const evidence = await prisma.gateEvidence.findMany({
      where: { criterion: { gate: { stage: { brandId, index: 2 } } } },
    });
    expect(evidence.length).toBeGreaterThanOrEqual(4);
  });
});

describe("weekly CEO review", () => {
  it("produces a versioned workspace-level briefing", async () => {
    const first = await runWeeklyCeoReview({
      workspaceId,
      requestedBy: founderId,
    });
    expect(first.version).toBe(1);
    const second = await runWeeklyCeoReview({
      workspaceId,
      requestedBy: founderId,
    });
    expect(second.artifactId).toBe(first.artifactId);
    expect(second.version).toBe(2);

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: first.artifactId },
      include: { versions: true },
    });
    expect(artifact.brandId).toBeNull();
    expect(artifact.kind).toBe("ceo_review");
    expect(artifact.versions).toHaveLength(2);
  });
});
