import { describe, expect, it } from "vitest";
import {
  BLUEPRINT_STAGES,
  FINAL_STAGE_INDEX,
  getStage,
  getStageBySlug,
  WORKSTREAM_TRACKS,
} from "../src/blueprint";

describe("blueprint stages", () => {
  it("defines the 11 stages 0..10 in order", () => {
    expect(BLUEPRINT_STAGES).toHaveLength(11);
    expect(FINAL_STAGE_INDEX).toBe(10);
    BLUEPRINT_STAGES.forEach((stage, i) => {
      expect(stage.index).toBe(i);
    });
    expect(getStage(0).slug).toBe("intake");
    expect(getStage(10).slug).toBe("systemize-scale");
  });

  it("has unique slugs and unique criterion keys within each stage", () => {
    const slugs = BLUEPRINT_STAGES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const stage of BLUEPRINT_STAGES) {
      const keys = stage.gateCriteria.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBeGreaterThan(0);
      expect(stage.requiredOutputs.length).toBeGreaterThan(0);
    }
  });

  it("marks founder-judgment criteria on the early gates", () => {
    expect(
      getStage(0).gateCriteria.find((c) => c.key === "research_spend_approved")
        ?.founderJudgment,
    ).toBe(true);
    expect(
      getStage(2).gateCriteria.find((c) => c.key === "founder_approves_build")
        ?.founderJudgment,
    ).toBe(true);
  });

  it("throws on out-of-range stage lookups and resolves slugs", () => {
    expect(() => getStage(11)).toThrow(RangeError);
    expect(() => getStage(-1)).toThrow(RangeError);
    expect(getStageBySlug("discover")?.index).toBe(1);
    expect(getStageBySlug("nope")).toBeUndefined();
  });

  it("defines both workstream tracks", () => {
    expect(WORKSTREAM_TRACKS.BRAND).toContain("Positioning");
    expect(WORKSTREAM_TRACKS.COMMERCIAL).toContain("Suppliers");
  });
});
