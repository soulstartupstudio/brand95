import { describe, expect, it } from "vitest";
import { getStage } from "../src/blueprint";
import {
  evaluateAdvance,
  evaluateGateReadiness,
  type CriterionState,
} from "../src/stage-machine";

function allMet(stageIndex: number): CriterionState[] {
  return getStage(stageIndex).gateCriteria.map((c) => ({
    key: c.key,
    status: "MET" as const,
  }));
}

describe("evaluateGateReadiness", () => {
  it("is not ready when criteria are missing or pending", () => {
    const result = evaluateGateReadiness(0, []);
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.blockers).toHaveLength(getStage(0).gateCriteria.length);
    }
  });

  it("is ready when every criterion is met", () => {
    expect(evaluateGateReadiness(0, allMet(0)).ready).toBe(true);
  });

  it("accepts waivers only with a recorded reason", () => {
    const criteria = allMet(1);
    criteria[0] = { key: criteria[0]!.key, status: "WAIVED", waivedReason: "" };
    const invalid = evaluateGateReadiness(1, criteria);
    expect(invalid.ready).toBe(false);

    criteria[0] = {
      key: criteria[0]!.key,
      status: "WAIVED",
      waivedReason: "Category-specific target; documented in decision log",
    };
    expect(evaluateGateReadiness(1, criteria).ready).toBe(true);
  });
});

describe("evaluateAdvance", () => {
  it("advances exactly one stage when gate is ready and founder-approved", () => {
    const result = evaluateAdvance({
      currentStageIndex: 0,
      criteria: allMet(0),
      gateApproved: true,
      deciderRole: "FOUNDER",
    });
    expect(result).toEqual({ ok: true, nextStageIndex: 1 });
  });

  it("refuses without founder approval, even when all evidence exists", () => {
    const result = evaluateAdvance({
      currentStageIndex: 0,
      criteria: allMet(0),
      gateApproved: false,
      deciderRole: "FOUNDER",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(" ")).toMatch(/approval/i);
    }
  });

  it("refuses when the decider is not the founder (no bypass)", () => {
    const result = evaluateAdvance({
      currentStageIndex: 0,
      criteria: allMet(0),
      gateApproved: true,
      deciderRole: "OPERATOR",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses when evidence criteria are incomplete, even if approved", () => {
    const result = evaluateAdvance({
      currentStageIndex: 1,
      criteria: [],
      gateApproved: true,
      deciderRole: "FOUNDER",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it("refuses to advance past the final stage", () => {
    const result = evaluateAdvance({
      currentStageIndex: 10,
      criteria: allMet(10),
      gateApproved: true,
      deciderRole: "FOUNDER",
    });
    expect(result.ok).toBe(false);
  });
});
