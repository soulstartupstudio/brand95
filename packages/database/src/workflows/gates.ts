import {
  approvalRequestContentSchema,
  canDecide,
  evaluateAdvance,
  evaluateGateReadiness,
  requiredApprovalLevel,
  type CriterionState,
  type DecisionOutcome,
} from "@brand95/domain";
import type { EvidenceType, Prisma } from "@prisma/client";
import { prisma } from "../client";

/**
 * Gate and approval workflows. All rules come from @brand95/domain; this
 * module persists state transitions and writes audit events. Approval
 * enforcement lives here — UI and agents cannot advance a stage or execute a
 * gated action any other way.
 */

type Tx = Prisma.TransactionClient;

async function loadCriterionStates(tx: Tx, gateId: string): Promise<CriterionState[]> {
  const criteria = await tx.gateCriterion.findMany({ where: { gateId } });
  return criteria.map((c) => ({
    key: c.key,
    status: c.status,
    waivedReason: c.waivedReason,
  }));
}

/** Recompute NOT_READY/READY from criteria. Never sets PASSED. */
async function refreshGateStatus(tx: Tx, gateId: string) {
  const gate = await tx.stageGate.findUniqueOrThrow({
    where: { id: gateId },
    include: { stage: true },
  });
  if (gate.status === "PASSED") return gate;

  const readiness = evaluateGateReadiness(
    gate.stage.index,
    await loadCriterionStates(tx, gateId),
  );
  return tx.stageGate.update({
    where: { id: gateId },
    data: { status: readiness.ready ? "READY" : "NOT_READY" },
  });
}

export async function recordEvidence(input: {
  criterionId: string;
  type: EvidenceType;
  source: string;
  note?: string;
  recordedBy: string;
}) {
  return prisma.$transaction(async (tx) => {
    const criterion = await tx.gateCriterion.findUniqueOrThrow({
      where: { id: input.criterionId },
      include: { gate: { include: { stage: true } } },
    });
    const evidence = await tx.gateEvidence.create({
      data: {
        criterionId: input.criterionId,
        type: input.type,
        source: input.source,
        note: input.note,
        recordedBy: input.recordedBy,
      },
    });
    await tx.event.create({
      data: {
        workspaceId: (await tx.brand.findUniqueOrThrow({
          where: { id: criterion.gate.stage.brandId },
        })).workspaceId,
        brandId: criterion.gate.stage.brandId,
        actorType: "USER",
        actorId: input.recordedBy,
        verb: "evidence.recorded",
        entityType: "GateEvidence",
        entityId: evidence.id,
        payload: { criterion: criterion.key, type: input.type, source: input.source },
      },
    });
    return evidence;
  });
}

export async function setCriterionStatus(input: {
  criterionId: string;
  status: "PENDING" | "MET" | "WAIVED";
  waivedReason?: string;
  actorId: string;
}) {
  if (input.status === "WAIVED" && !input.waivedReason?.trim()) {
    throw new Error("A waiver requires a recorded reason.");
  }
  return prisma.$transaction(async (tx) => {
    const criterion = await tx.gateCriterion.update({
      where: { id: input.criterionId },
      data: {
        status: input.status,
        waivedReason: input.status === "WAIVED" ? input.waivedReason : null,
      },
      include: { gate: { include: { stage: true } } },
    });
    const gate = await refreshGateStatus(tx, criterion.gateId);
    const brand = await tx.brand.findUniqueOrThrow({
      where: { id: criterion.gate.stage.brandId },
    });
    await tx.event.create({
      data: {
        workspaceId: brand.workspaceId,
        brandId: brand.id,
        actorType: "USER",
        actorId: input.actorId,
        verb: "criterion.updated",
        entityType: "GateCriterion",
        entityId: criterion.id,
        payload: {
          key: criterion.key,
          status: input.status,
          waivedReason: input.waivedReason ?? null,
          gateStatus: gate.status,
        },
      },
    });
    return { criterion, gateStatus: gate.status };
  });
}

/**
 * Create the Level 3 stage-gate approval request for a READY gate.
 * Idempotent: an existing PENDING request for the gate is returned as-is.
 */
export async function requestGateApproval(input: {
  gateId: string;
  requestedBy: string; // user id or agent key
  whyNow?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const gate = await tx.stageGate.findUniqueOrThrow({
      where: { id: input.gateId },
      include: {
        stage: { include: { brand: true } },
        approvalRequest: true,
        criteria: { include: { evidence: true } },
      },
    });

    if (gate.status === "PASSED") {
      throw new Error("Gate has already been passed.");
    }
    if (
      gate.approvalRequest &&
      gate.approvalRequest.status === "PENDING"
    ) {
      return { request: gate.approvalRequest, created: false as const };
    }

    const readiness = evaluateGateReadiness(
      gate.stage.index,
      gate.criteria.map((c) => ({
        key: c.key,
        status: c.status,
        waivedReason: c.waivedReason,
      })),
    );
    if (!readiness.ready) {
      throw new Error(
        `Gate is not ready for approval:\n${readiness.blockers.join("\n")}`,
      );
    }

    const brand = gate.stage.brand;
    const evidenceSummary = gate.criteria.flatMap((c) =>
      c.evidence.map((e) => `${c.key}: [${e.type}] ${e.source}`),
    );
    const content = approvalRequestContentSchema.parse({
      proposedAction: `Pass the "${gate.stage.name}" gate for ${brand.name} and advance to the next stage`,
      actionType: "stage_gate_approval",
      whyNow:
        input.whyNow ??
        `All ${gate.criteria.length} gate criteria are met or waived with reasons.`,
      evidence: evidenceSummary,
      costExposure:
        "Unlocks the next stage's workstreams and any spend they entail.",
      reversibility: "REVERSIBLE",
      alternatives: ["Hold for more evidence", "Revise this stage", "Park the brand"],
      recommendation: "Review criteria and evidence, then decide.",
      expiresAt: null,
    });

    const request = await tx.approvalRequest.create({
      data: {
        workspaceId: brand.workspaceId,
        brandId: brand.id,
        level: requiredApprovalLevel("stage_gate_approval"),
        actionType: "stage_gate_approval",
        content,
        requestedBy: input.requestedBy,
      },
    });
    await tx.stageGate.update({
      where: { id: gate.id },
      data: { approvalRequestId: request.id },
    });
    await tx.event.create({
      data: {
        workspaceId: brand.workspaceId,
        brandId: brand.id,
        actorType: "USER",
        actorId: input.requestedBy,
        verb: "gate.approval_requested",
        entityType: "ApprovalRequest",
        entityId: request.id,
        payload: { stage: gate.stage.slug },
      },
    });
    return { request, created: true as const };
  });
}

/**
 * Decide an approval request. Role checks come from the domain policy; a
 * request is decidable exactly once. Approving a stage-gate request runs the
 * stage advance through the domain state machine inside the same transaction.
 */
export async function decideApproval(input: {
  requestId: string;
  deciderId: string;
  outcome: DecisionOutcome;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: { decision: true, gate: { include: { stage: true } } },
    });
    if (request.status !== "PENDING") {
      throw new Error(`Request is ${request.status}, not PENDING.`);
    }
    if (request.decision) {
      throw new Error("Request already has a decision.");
    }
    if (request.expiresAt && request.expiresAt < new Date()) {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("Request has expired.");
    }

    const decider = await tx.user.findUniqueOrThrow({
      where: { id: input.deciderId },
    });
    if (!canDecide(request.level as 0 | 1 | 2 | 3, decider.role)) {
      throw new Error(
        `Role ${decider.role} cannot decide a Level ${request.level} request.`,
      );
    }

    const decision = await tx.approvalDecision.create({
      data: {
        requestId: request.id,
        outcome: input.outcome,
        note: input.note,
        decidedById: decider.id,
      },
    });
    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: input.outcome },
    });
    await tx.event.create({
      data: {
        workspaceId: request.workspaceId,
        brandId: request.brandId,
        actorType: "USER",
        actorId: decider.id,
        verb: "approval.decided",
        entityType: "ApprovalRequest",
        entityId: request.id,
        payload: { outcome: input.outcome, level: request.level, note: input.note ?? null },
      },
    });

    let advanced: { fromStage: number; toStage: number } | null = null;
    if (request.gate && input.outcome === "APPROVED") {
      advanced = await advanceStageAfterGateApproval(tx, request.gate.id, decider);
    }

    return { decision, request: updated, advanced };
  });
}

async function advanceStageAfterGateApproval(
  tx: Tx,
  gateId: string,
  decider: { id: string; role: "FOUNDER" | "OPERATOR" | "VIEWER" },
) {
  const gate = await tx.stageGate.findUniqueOrThrow({
    where: { id: gateId },
    include: { stage: { include: { brand: true } } },
  });
  const brand = gate.stage.brand;

  if (brand.currentStageIndex !== gate.stage.index) {
    throw new Error(
      `Gate belongs to stage ${gate.stage.index} but the brand is at stage ${brand.currentStageIndex}.`,
    );
  }

  const verdict = evaluateAdvance({
    currentStageIndex: brand.currentStageIndex,
    criteria: await loadCriterionStates(tx, gateId),
    gateApproved: true,
    deciderRole: decider.role,
  });
  if (!verdict.ok) {
    throw new Error(`Stage advance refused:\n${verdict.reasons.join("\n")}`);
  }

  await tx.stageGate.update({
    where: { id: gateId },
    data: { status: "PASSED", passedAt: new Date() },
  });
  await tx.brandStage.update({
    where: { id: gate.stageId },
    data: { status: "COMPLETE" },
  });
  await tx.brandStage.update({
    where: {
      brandId_index: { brandId: brand.id, index: verdict.nextStageIndex },
    },
    data: { status: "ACTIVE" },
  });
  await tx.brand.update({
    where: { id: brand.id },
    data: { currentStageIndex: verdict.nextStageIndex },
  });
  await tx.decision.create({
    data: {
      brandId: brand.id,
      title: `Passed "${gate.stage.name}" gate`,
      outcome: "PROCEED",
      rationale: "Stage-gate approval granted by founder.",
      decidedById: decider.id,
    },
  });
  await tx.event.create({
    data: {
      workspaceId: brand.workspaceId,
      brandId: brand.id,
      actorType: "USER",
      actorId: decider.id,
      verb: "stage.advanced",
      entityType: "Brand",
      entityId: brand.id,
      payload: { from: gate.stage.index, to: verdict.nextStageIndex },
    },
  });

  return { fromStage: gate.stage.index, toStage: verdict.nextStageIndex };
}
