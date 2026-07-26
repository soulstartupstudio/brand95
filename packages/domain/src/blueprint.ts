/**
 * The Brand95 Blueprint: a stage-gated state machine from Intake (0) to
 * Systemize and Scale (10). This module is the single authoritative source of
 * stage definitions — the database instantiates brand stages from this data,
 * and the UI renders it. Spec: README.md §1.
 */

export type WorkstreamTrack = "BRAND" | "COMMERCIAL";

export interface GateCriterionDef {
  /** Stable key, unique within the stage. */
  key: string;
  label: string;
  /** True when the criterion can only be satisfied by an explicit founder call. */
  founderJudgment?: boolean;
  /** Default measurable target, adjustable per category with a documented reason. */
  evidenceTarget?: string;
}

export interface StageDef {
  index: number;
  slug: string;
  name: string;
  purpose: string;
  requiredOutputs: string[];
  gateCriteria: GateCriterionDef[];
}

export const BLUEPRINT_STAGES: readonly StageDef[] = [
  {
    index: 0,
    slug: "intake",
    name: "Intake",
    purpose: "Convert a loose idea into a structured brand candidate.",
    requiredOutputs: [
      "Working brand name or codename",
      "Product concept",
      "Customer hypothesis",
      "Problem or desire addressed",
      "Intended price range",
      "Geographic starting market",
      "Founder conviction statement",
      "Known constraints",
      "Initial D2C and retail hypothesis",
    ],
    gateCriteria: [
      { key: "intake_complete", label: "Intake form complete" },
      {
        key: "research_spend_approved",
        label: "Founder explicitly approves research spend/time",
        founderJudgment: true,
      },
    ],
  },
  {
    index: 1,
    slug: "discover",
    name: "Discover",
    purpose: "Determine whether the opportunity deserves validation.",
    requiredOutputs: [
      "Customer problem and jobs-to-be-done",
      "Category and trend analysis",
      "Competitor map",
      "Price architecture",
      "D2C opportunity",
      "Retail opportunity",
      "Gross-margin feasibility",
      "Operational complexity",
      "Regulatory and claims risks",
      "Differentiation options",
      "Opportunity Memo with recommendation",
    ],
    gateCriteria: [
      {
        key: "clear_customer_problem",
        label: "Clear customer problem or desire",
        evidenceTarget: "At least 15 meaningful customer signals or interviews",
      },
      {
        key: "plausible_differentiation",
        label: "Plausible differentiation",
        evidenceTarget: "At least 10 credible competitors or substitutes reviewed",
      },
      {
        key: "plausible_gross_margin",
        label: "Plausible route to gross margin",
        evidenceTarget: "Initial unit economics with low/base/high estimates",
      },
      {
        key: "no_fatal_blocker",
        label: "No unresolved fatal regulatory or supply-chain blocker",
      },
      {
        key: "founder_approval",
        label: "Founder approves proceeding to validation",
        founderJudgment: true,
      },
    ],
  },
  {
    index: 2,
    slug: "validate",
    name: "Validate",
    purpose:
      "Obtain behavioral evidence before committing meaningful inventory or build cost.",
    requiredOutputs: [
      "Chosen validation method(s)",
      "Experiment plan",
      "Evidence log",
      "Validation report",
      "Chosen route: retail-first, D2C-first, or dual (with rationale)",
    ],
    gateCriteria: [
      {
        key: "behavioral_evidence",
        label: "Evidence is behavioral, not only compliments",
        evidenceTarget:
          "100 qualified signups, or 25 paid/refundable reservations, or 10 credible retailer expressions with ≥3 written opening-order indications, or founder-approved equivalent",
      },
      {
        key: "customer_clarity",
        label: "Target customer and use occasion clearer than at intake",
      },
      { key: "price_resistance_understood", label: "Price resistance is understood" },
      {
        key: "channel_traction",
        label: "At least one viable channel shows traction",
      },
      {
        key: "founder_approves_build",
        label: "Founder approves build",
        founderJudgment: true,
      },
    ],
  },
  {
    index: 3,
    slug: "build-brand",
    name: "Build Brand",
    purpose: "Create a recognizable, ownable, commercially usable brand.",
    requiredOutputs: [
      "Final name and availability checks",
      "Positioning statement",
      "One-line proposition",
      "Brand story",
      "Audience definition",
      "Personality and tone",
      "Messaging hierarchy",
      "Visual identity brief",
      "Logo system",
      "Color palette",
      "Typography",
      "Packaging architecture",
      "Claims and copy review",
      "Brand guidelines",
      "Asset library structure",
    ],
    gateCriteria: [
      {
        key: "brand_system_approved",
        label: "Founder approves brand system",
        founderJudgment: true,
      },
      { key: "legal_checks_logged", label: "Required legal/name checks logged" },
      {
        key: "production_files_ready",
        label: "Production-ready files exist or are assigned",
      },
      {
        key: "quality_test",
        label:
          "Passes the Brand95 quality test (5-second comprehension, 5-metre recognition, distinct, flexible, no long explanation)",
      },
    ],
  },
  {
    index: 4,
    slug: "hero-product",
    name: "Hero Product",
    purpose: "Finalize one product worth building the brand around.",
    requiredOutputs: [
      "Product requirements document",
      "Bill of materials where relevant",
      "Product and packaging specifications",
      "Supplier shortlist",
      "Samples and sample review",
      "Costing by volume tier",
      "MOQ and lead times",
      "Wholesale and retail price architecture",
      "Gross-margin model (D2C and wholesale shown separately)",
      "QC checklist",
      "Compliance checklist",
      "Packaging dielines/files",
      "Production plan",
      "Inventory risk assessment",
    ],
    gateCriteria: [
      { key: "golden_sample_approved", label: "Golden sample approved" },
      {
        key: "landed_cost_verified",
        label: "Landed cost verified or clearly estimated",
        evidenceTarget:
          "Includes freight, duties, packaging, payment fees, returns allowance, and fulfilment",
      },
      {
        key: "production_qc_approved",
        label: "Production and QC plan approved",
        founderJudgment: true,
      },
      {
        key: "mvo_supported",
        label: "Minimum viable order is supported by validation evidence",
      },
    ],
  },
  {
    index: 5,
    slug: "buying-experience",
    name: "Buying Experience",
    purpose: "Make the brand genuinely purchasable and credible.",
    requiredOutputs: [
      "Shopify storefront or equivalent",
      "Product detail page",
      "Checkout and payments",
      "Shipping and returns policy",
      "FAQ",
      "Contact/support flow",
      "Analytics and event tracking",
      "Email capture",
      "Core lifecycle emails",
      "Product and lifestyle assets",
      "Wholesale page or buyer materials if relevant",
      "Retail display concept if relevant",
    ],
    gateCriteria: [
      { key: "e2e_order_succeeds", label: "End-to-end test order succeeds" },
      { key: "mobile_qa_passes", label: "Mobile QA passes" },
      { key: "analytics_verified", label: "Analytics events verified" },
      {
        key: "policies_pricing_approved",
        label: "Policies and pricing approved",
        founderJudgment: true,
      },
      { key: "no_placeholders", label: "No placeholder content remains" },
    ],
  },
  {
    index: 6,
    slug: "launch",
    name: "Launch and First 100 Customers",
    purpose:
      "Prove strangers will buy and identify the first repeatable demand signals.",
    requiredOutputs: [
      "Source-of-purchase tracking",
      "Conversion rate",
      "Average order value",
      "Refund/return rate",
      "Review rate",
      "Common objections",
      "UGC and creator response",
      "Defect/confusion log",
    ],
    gateCriteria: [
      {
        key: "hundred_customers",
        label: "100 paying customers or founder-approved equivalent",
        evidenceTarget: "100 paying end customers; 20 substantive reviews; 10 usable UGC assets",
      },
      { key: "quality_acceptable", label: "Product quality is acceptable" },
      { key: "contribution_measured", label: "Contribution margin is measured" },
      {
        key: "acquisition_promise",
        label: "At least one acquisition path shows promise",
      },
    ],
  },
  {
    index: 7,
    slug: "retail-validation",
    name: "Retail Validation",
    purpose: "Establish retail as a measurable channel, not a vanity list.",
    requiredOutputs: [
      "Wholesale price list",
      "Terms and MOQ",
      "Line sheet/catalogue",
      "Retail sample kit",
      "Display concept",
      "Retail prospect database",
      "Outreach sequences",
      "Buyer meeting format",
      "Order and reorder tracking",
      "Faire or marketplace profile where useful",
    ],
    gateCriteria: [
      {
        key: "active_stockists",
        label: "10 active paying retailers",
        evidenceTarget: "50 qualified retailer prospects contacted; 10 paying stockists",
      },
      {
        key: "reorder_signal",
        label: "Reorder or sell-through signal exists",
        evidenceTarget: "At least 3 reorders or sufficient sell-through evidence",
      },
      { key: "wholesale_economics", label: "Wholesale unit economics work" },
      {
        key: "fulfilment_reliable",
        label: "Fulfilment and account support are reliable",
      },
    ],
  },
  {
    index: 8,
    slug: "repeatable-growth",
    name: "Repeatable Growth",
    purpose: "Turn isolated wins into a predictable commercial engine.",
    requiredOutputs: [
      "Revenue by channel",
      "Contribution margin by channel",
      "CAC and payback where measurable",
      "AOV, conversion rate, repeat rate",
      "Wholesale reorder rate",
      "Inventory cover",
      "Cash runway",
    ],
    gateCriteria: [
      { key: "repeatable_channel", label: "At least one channel is repeatable" },
      {
        key: "positive_contribution",
        label: "Positive contribution margin in base case",
      },
      {
        key: "inventory_cash_controlled",
        label: "Inventory and cash planning are controlled",
      },
      {
        key: "scaling_spend_approved",
        label: "Founder approves scaling spend",
        founderJudgment: true,
      },
    ],
  },
  {
    index: 9,
    slug: "brand-ecosystem",
    name: "Brand Ecosystem",
    purpose: "Expand only after the hero product is validated.",
    requiredOutputs: [
      "Mini opportunity memo per new SKU",
      "Unit economics per new SKU",
      "Assortment plan (no bloat)",
    ],
    gateCriteria: [
      {
        key: "viable_skus",
        label:
          "At least three commercially viable SKUs or a clearly profitable focused assortment",
      },
      {
        key: "inventory_complexity",
        label: "Inventory complexity remains manageable",
      },
      {
        key: "cross_sell_proven",
        label: "Cross-sell or repeat behavior is proven",
      },
    ],
  },
  {
    index: 10,
    slug: "systemize-scale",
    name: "Systemize and Scale",
    purpose: "Make the brand operate without constant founder intervention.",
    requiredOutputs: [
      "Role ownership",
      "SOP library",
      "KPI dashboard",
      "Forecast and inventory cadence",
      "Monthly operating review",
      "Supplier scorecards",
      "Customer support standards",
      "Automation coverage map",
      "Risk register",
      "Annual brand plan",
    ],
    gateCriteria: [
      {
        key: "founder_free_month",
        label: "Brand can run for four weeks without founder operational intervention",
      },
      {
        key: "exceptions_visible",
        label: "Exceptions and approvals are visible",
      },
      {
        key: "owned_processes",
        label: "Key processes have owners and documented fallbacks",
      },
    ],
  },
] as const;

export const FINAL_STAGE_INDEX = BLUEPRINT_STAGES.length - 1;

export function getStage(index: number): StageDef {
  const stage = BLUEPRINT_STAGES[index];
  if (!stage) {
    throw new RangeError(`No blueprint stage with index ${index}`);
  }
  return stage;
}

export function getStageBySlug(slug: string): StageDef | undefined {
  return BLUEPRINT_STAGES.find((s) => s.slug === slug);
}

/** The two parallel tracks that converge at launch (spec §2). */
export const WORKSTREAM_TRACKS: Record<WorkstreamTrack, string[]> = {
  BRAND: [
    "Positioning",
    "Naming",
    "Identity",
    "Packaging",
    "Storytelling",
    "Ecommerce experience",
    "Content system",
    "Creative assets",
  ],
  COMMERCIAL: [
    "Product feasibility",
    "Suppliers",
    "Costing",
    "Compliance",
    "Validation",
    "Retail proposition",
    "Wholesale assets",
    "Logistics",
    "Inventory",
    "Sales pipeline",
  ],
};
