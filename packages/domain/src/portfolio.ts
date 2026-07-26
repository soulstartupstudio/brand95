/**
 * Portfolio discipline rules (spec: "One active build, one validation
 * project"). The system warns — the founder can explicitly override.
 */

export interface PortfolioBrandSummary {
  id: string;
  name: string;
  currentStageIndex: number;
  status: "ACTIVE" | "PARKED" | "REJECTED" | "ARCHIVED";
}

export interface PortfolioWarning {
  code: "TOO_MANY_BUILDS" | "TOO_MANY_VALIDATIONS";
  message: string;
  brandNames: string[];
}

/** Stages 3–6 are "build" stages; stages 1–2 are discovery/validation. */
const BUILD_RANGE: [number, number] = [3, 6];
const VALIDATION_RANGE: [number, number] = [1, 2];

export function checkPortfolioDiscipline(
  brands: PortfolioBrandSummary[],
): PortfolioWarning[] {
  const active = brands.filter((b) => b.status === "ACTIVE");
  const inRange = ([lo, hi]: [number, number]) =>
    active.filter((b) => b.currentStageIndex >= lo && b.currentStageIndex <= hi);

  const warnings: PortfolioWarning[] = [];
  const builds = inRange(BUILD_RANGE);
  if (builds.length > 1) {
    warnings.push({
      code: "TOO_MANY_BUILDS",
      message: `Portfolio has ${builds.length} brands in active build; the Brand95 rule is one active build at a time.`,
      brandNames: builds.map((b) => b.name),
    });
  }
  const validations = inRange(VALIDATION_RANGE);
  if (validations.length > 1) {
    warnings.push({
      code: "TOO_MANY_VALIDATIONS",
      message: `Portfolio has ${validations.length} brands in discovery/validation; the Brand95 rule is one validation project at a time.`,
      brandNames: validations.map((b) => b.name),
    });
  }
  return warnings;
}
