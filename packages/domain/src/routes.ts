/**
 * Retail-first versus D2C-first versus dual validation logic (spec §14).
 * The system recommends a route; the founder decides, and the decision plus
 * rationale is stored in the Decision log.
 */

export type ValidationRoute = "RETAIL_FIRST" | "D2C_FIRST" | "DUAL";

export interface RouteSignals {
  /** Product is highly discoverable or impulse-driven. */
  impulseDriven: boolean;
  /** Retail buyers can understand the product quickly. */
  buyerQuickToUnderstand: boolean;
  /** A physical display materially improves conversion. */
  displayImprovesConversion: boolean;
  /** Opening orders can meaningfully reduce inventory risk. */
  openingOrdersReduceRisk: boolean;
  /** Wholesale unit economics work at target price. */
  wholesaleEconomicsWork: boolean;
  /** Customer education is needed before purchase. */
  educationNeeded: boolean;
  /** Customer data and feedback are especially important right now. */
  customerDataImportant: boolean;
  /** Margin supports paid acquisition testing. */
  marginSupportsAcquisition: boolean;
  /** Retail buyers demand consumer proof before stocking. */
  buyersDemandConsumerProof: boolean;
}

export interface RouteRecommendation {
  route: ValidationRoute;
  retailScore: number;
  d2cScore: number;
  rationale: string[];
}

/**
 * Score both routes from the signal set; recommend DUAL when both routes are
 * plausible (the Camera95-like default), otherwise the clearly stronger one.
 */
export function recommendValidationRoute(signals: RouteSignals): RouteRecommendation {
  const rationale: string[] = [];

  const retailSignals: [boolean, string][] = [
    [signals.impulseDriven, "Product is discoverable/impulse-driven"],
    [signals.buyerQuickToUnderstand, "Buyers understand it quickly"],
    [signals.displayImprovesConversion, "Display materially improves conversion"],
    [signals.openingOrdersReduceRisk, "Opening orders reduce inventory risk"],
    [signals.wholesaleEconomicsWork, "Wholesale economics work"],
  ];
  const d2cSignals: [boolean, string][] = [
    [signals.educationNeeded, "Product education is needed"],
    [signals.customerDataImportant, "Customer data and feedback are important"],
    [signals.marginSupportsAcquisition, "Margin supports acquisition testing"],
    [signals.buyersDemandConsumerProof, "Buyers demand consumer proof"],
  ];

  const retailScore = retailSignals.filter(([on]) => on).length;
  const d2cScore = d2cSignals.filter(([on]) => on).length;

  for (const [on, label] of retailSignals) if (on) rationale.push(`Retail: ${label}`);
  for (const [on, label] of d2cSignals) if (on) rationale.push(`D2C: ${label}`);

  // Wholesale economics that don't work is close to disqualifying for
  // retail-first; buyers demanding consumer proof forces D2C evidence first.
  const retailViable = signals.wholesaleEconomicsWork && retailScore >= 3;
  const d2cViable = d2cScore >= 2;

  let route: ValidationRoute;
  if (retailViable && d2cViable) {
    route = "DUAL";
    rationale.push(
      "Both routes are plausible: build D2C proof while pre-selling selected retailers; place larger production only after combined evidence.",
    );
  } else if (retailViable) {
    route = "RETAIL_FIRST";
    rationale.push(
      "Retail-first: validate with final-looking sample, display concept, line sheet, 30–50 high-fit prospects, and written opening-order indications.",
    );
  } else {
    route = "D2C_FIRST";
    rationale.push(
      "D2C-first: validate with landing page or small batch, first 25–100 customers, reviews/UGC, and pricing evidence before wholesale.",
    );
  }

  return { route, retailScore, d2cScore, rationale };
}
