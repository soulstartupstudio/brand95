import { BLUEPRINT_STAGES } from "@brand95/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { createBrandWithBlueprint } from "../src/workflows/create-brand";
import {
  decideApproval,
  recordEvidence,
  requestGateApproval,
  setCriterionStatus,
} from "../src/workflows/gates";

let workspaceId: string;
let founderId: string;
let operatorId: string;

beforeAll(async () => {
  const workspace = await prisma.workspace.create({
    data: { name: `test-${Date.now()}` },
  });
  workspaceId = workspace.id;
  founderId = (
    await prisma.user.create({
      data: {
        workspaceId,
        email: `founder-${Date.now()}@test.example`,
        name: "Founder",
        role: "FOUNDER",
      },
    })
  ).id;
  operatorId = (
    await prisma.user.create({
      data: {
        workspaceId,
        email: `operator-${Date.now()}@test.example`,
        name: "Operator",
        role: "OPERATOR",
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeBrand(name: string) {
  const { brand } = await createBrandWithBlueprint({
    workspaceId,
    createdById: founderId,
    name,
    concept: "A test product concept for integration testing.",
  });
  return brand;
}

async function gateOf(brandId: string, index: number) {
  const stage = await prisma.brandStage.findUniqueOrThrow({
    where: { brandId_index: { brandId, index } },
  });
  return prisma.stageGate.findUniqueOrThrow({
    where: { stageId: stage.id },
    include: { criteria: true },
  });
}

describe("New Brand Intake workflow", () => {
  it("instantiates the full blueprint with stage 0 active", async () => {
    const brand = await makeBrand("TestBrand");
    const stages = await prisma.brandStage.findMany({
      where: { brandId: brand.id },
      orderBy: { index: "asc" },
      include: { gate: { include: { criteria: true } } },
    });
    expect(stages).toHaveLength(BLUEPRINT_STAGES.length);
    expect(stages[0]!.status).toBe("ACTIVE");
    expect(stages[1]!.status).toBe("LOCKED");
    for (const [i, stage] of stages.entries()) {
      expect(stage.gate?.criteria).toHaveLength(
        BLUEPRINT_STAGES[i]!.gateCriteria.length,
      );
    }
    const workstreams = await prisma.workstream.count({
      where: { brandId: brand.id },
    });
    expect(workstreams).toBe(18); // 8 brand + 10 commercial
    const events = await prisma.event.findMany({
      where: { brandId: brand.id, verb: "brand.created" },
    });
    expect(events).toHaveLength(1);
  });

  it("is idempotent by workspace + name (no duplicates on retry)", async () => {
    const first = await createBrandWithBlueprint({
      workspaceId,
      createdById: founderId,
      name: "IdempotentBrand",
      concept: "A test product concept for idempotency.",
    });
    const second = await createBrandWithBlueprint({
      workspaceId,
      createdById: founderId,
      name: "IdempotentBrand",
      concept: "A different concept that must not overwrite anything.",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.brand.id).toBe(first.brand.id);
    const stageCount = await prisma.brandStage.count({
      where: { brandId: first.brand.id },
    });
    expect(stageCount).toBe(BLUEPRINT_STAGES.length);
  });
});

describe("gate approval workflow", () => {
  it("refuses an approval request while criteria are pending", async () => {
    const brand = await makeBrand("NotReadyBrand");
    const gate = await gateOf(brand.id, 0);
    await expect(
      requestGateApproval({ gateId: gate.id, requestedBy: founderId }),
    ).rejects.toThrow(/not ready/i);
  });

  it("refuses waivers without a reason", async () => {
    const brand = await makeBrand("WaiverBrand");
    const gate = await gateOf(brand.id, 0);
    await expect(
      setCriterionStatus({
        criterionId: gate.criteria[0]!.id,
        status: "WAIVED",
        actorId: founderId,
      }),
    ).rejects.toThrow(/reason/i);
  });

  it("blocks operators from deciding Level 3 gate approvals", async () => {
    const brand = await makeBrand("RoleBrand");
    const gate = await gateOf(brand.id, 0);
    for (const c of gate.criteria) {
      await setCriterionStatus({
        criterionId: c.id,
        status: "MET",
        actorId: founderId,
      });
    }
    const { request } = await requestGateApproval({
      gateId: gate.id,
      requestedBy: operatorId,
    });
    await expect(
      decideApproval({
        requestId: request.id,
        deciderId: operatorId,
        outcome: "APPROVED",
      }),
    ).rejects.toThrow(/cannot decide/i);
    // Brand must not have advanced.
    const fresh = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
    });
    expect(fresh.currentStageIndex).toBe(0);
  });

  it("advances exactly one stage on founder approval, with audit trail", async () => {
    const brand = await makeBrand("HappyBrand");
    const gate = await gateOf(brand.id, 0);
    for (const c of gate.criteria) {
      await setCriterionStatus({
        criterionId: c.id,
        status: "MET",
        actorId: founderId,
      });
    }
    const readyGate = await prisma.stageGate.findUniqueOrThrow({
      where: { id: gate.id },
    });
    expect(readyGate.status).toBe("READY");

    const { request, created } = await requestGateApproval({
      gateId: gate.id,
      requestedBy: founderId,
    });
    expect(created).toBe(true);
    // Idempotent: a second request returns the same pending one.
    const again = await requestGateApproval({
      gateId: gate.id,
      requestedBy: founderId,
    });
    expect(again.created).toBe(false);
    expect(again.request.id).toBe(request.id);

    const { advanced } = await decideApproval({
      requestId: request.id,
      deciderId: founderId,
      outcome: "APPROVED",
      note: "Proceed to Discover.",
    });
    expect(advanced).toEqual({ fromStage: 0, toStage: 1 });

    const fresh = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      include: { stages: { orderBy: { index: "asc" } } },
    });
    expect(fresh.currentStageIndex).toBe(1);
    expect(fresh.stages[0]!.status).toBe("COMPLETE");
    expect(fresh.stages[1]!.status).toBe("ACTIVE");

    const verbs = (
      await prisma.event.findMany({
        where: { brandId: brand.id },
        orderBy: { createdAt: "asc" },
      })
    ).map((e) => e.verb);
    expect(verbs).toContain("gate.approval_requested");
    expect(verbs).toContain("approval.decided");
    expect(verbs).toContain("stage.advanced");

    // A decided request cannot be decided again.
    await expect(
      decideApproval({
        requestId: request.id,
        deciderId: founderId,
        outcome: "REJECTED",
      }),
    ).rejects.toThrow(/not PENDING/i);
  });

  it("records evidence rows with events", async () => {
    const brand = await makeBrand("EvidenceBrand");
    const gate = await gateOf(brand.id, 0);
    const evidence = await recordEvidence({
      criterionId: gate.criteria[0]!.id,
      type: "INTERVIEW",
      source: "Interview with a target customer",
      note: "Strong signal",
      recordedBy: founderId,
    });
    expect(evidence.id).toBeTruthy();
    const events = await prisma.event.findMany({
      where: { brandId: brand.id, verb: "evidence.recorded" },
    });
    expect(events).toHaveLength(1);
  });
});
