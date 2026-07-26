import { FINAL_STAGE_INDEX, getStage } from "./blueprint";

/**
 * Pure stage-gate state machine. The database stores the state; these
 * functions are the only place transition rules live, so the web app,
 * workers, and tests all enforce identical rules.
 */

export const CRITERION_STATUSES = ["PENDING", "MET", "WAIVED"] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];

export interface CriterionState {
  key: string;
  status: CriterionStatus;
  /** Required when status is WAIVED — waivers without reasons are invalid. */
  waivedReason?: string | null;
}

export type GateReadiness =
  | { ready: true }
  | { ready: false; blockers: string[] };

/**
 * A gate is ready for a founder decision when every criterion of the stage is
 * MET, or WAIVED with a recorded reason. Readiness never advances the brand
 * by itself — passage additionally requires an approved Level 3 decision.
 */
export function evaluateGateReadiness(
  stageIndex: number,
  criteria: CriterionState[],
): GateReadiness {
  const stage = getStage(stageIndex);
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  const blockers: string[] = [];

  for (const def of stage.gateCriteria) {
    const state = byKey.get(def.key);
    if (!state || state.status === "PENDING") {
      blockers.push(`Criterion not met: ${def.label}`);
      continue;
    }
    if (state.status === "WAIVED" && !state.waivedReason?.trim()) {
      blockers.push(`Waived without a recorded reason: ${def.label}`);
    }
  }

  return blockers.length === 0 ? { ready: true } : { ready: false, blockers };
}

export interface AdvanceInput {
  currentStageIndex: number;
  criteria: CriterionState[];
  /** True only when an APPROVED Level 3 decision exists for this gate. */
  gateApproved: boolean;
  deciderRole: "FOUNDER" | "OPERATOR" | "VIEWER";
}

export type AdvanceResult =
  | { ok: true; nextStageIndex: number }
  | { ok: false; reasons: string[] };

/**
 * The only legal transition: current stage → next stage, with a ready gate
 * and an explicit founder approval. No skipping, no silent approvals.
 */
export function evaluateAdvance(input: AdvanceInput): AdvanceResult {
  const reasons: string[] = [];

  if (input.currentStageIndex >= FINAL_STAGE_INDEX) {
    return { ok: false, reasons: ["Brand is already at the final stage."] };
  }

  const readiness = evaluateGateReadiness(input.currentStageIndex, input.criteria);
  if (!readiness.ready) {
    reasons.push(...readiness.blockers);
  }

  if (!input.gateApproved) {
    reasons.push("Stage-gate approval (Level 3) has not been granted.");
  }

  if (input.deciderRole !== "FOUNDER") {
    reasons.push("Stage gates can only be approved by the founder.");
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  return { ok: true, nextStageIndex: input.currentStageIndex + 1 };
}
