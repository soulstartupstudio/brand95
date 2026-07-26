import { describe, expect, it } from "vitest";
import { recommendValidationRoute, type RouteSignals } from "../src/routes";
import { checkPortfolioDiscipline } from "../src/portfolio";

const base: RouteSignals = {
  impulseDriven: false,
  buyerQuickToUnderstand: false,
  displayImprovesConversion: false,
  openingOrdersReduceRisk: false,
  wholesaleEconomicsWork: false,
  educationNeeded: false,
  customerDataImportant: false,
  marginSupportsAcquisition: false,
  buyersDemandConsumerProof: false,
};

describe("recommendValidationRoute", () => {
  it("recommends DUAL for Camera95-like products (strong on both sides)", () => {
    const rec = recommendValidationRoute({
      ...base,
      impulseDriven: true,
      buyerQuickToUnderstand: true,
      displayImprovesConversion: true,
      wholesaleEconomicsWork: true,
      customerDataImportant: true,
      marginSupportsAcquisition: true,
    });
    expect(rec.route).toBe("DUAL");
  });

  it("recommends RETAIL_FIRST when retail signals dominate", () => {
    const rec = recommendValidationRoute({
      ...base,
      impulseDriven: true,
      buyerQuickToUnderstand: true,
      openingOrdersReduceRisk: true,
      wholesaleEconomicsWork: true,
    });
    expect(rec.route).toBe("RETAIL_FIRST");
  });

  it("never recommends retail-first when wholesale economics fail", () => {
    const rec = recommendValidationRoute({
      ...base,
      impulseDriven: true,
      buyerQuickToUnderstand: true,
      displayImprovesConversion: true,
      openingOrdersReduceRisk: true,
      educationNeeded: true,
      customerDataImportant: true,
    });
    expect(rec.route).toBe("D2C_FIRST");
  });

  it("always returns a non-empty rationale", () => {
    expect(recommendValidationRoute(base).rationale.length).toBeGreaterThan(0);
  });
});

describe("checkPortfolioDiscipline", () => {
  it("warns when more than one brand is in active build", () => {
    const warnings = checkPortfolioDiscipline([
      { id: "1", name: "Camera95", currentStageIndex: 4, status: "ACTIVE" },
      { id: "2", name: "Hold", currentStageIndex: 3, status: "ACTIVE" },
      { id: "3", name: "Crossbody", currentStageIndex: 1, status: "ACTIVE" },
    ]);
    expect(warnings.map((w) => w.code)).toContain("TOO_MANY_BUILDS");
  });

  it("ignores parked and rejected brands", () => {
    const warnings = checkPortfolioDiscipline([
      { id: "1", name: "Camera95", currentStageIndex: 4, status: "ACTIVE" },
      { id: "2", name: "Hold", currentStageIndex: 4, status: "PARKED" },
    ]);
    expect(warnings).toHaveLength(0);
  });
});
