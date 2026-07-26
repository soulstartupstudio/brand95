import { z } from "zod";

/**
 * Approval framework (spec §9). The workflow layer consults this policy for
 * every proposed action; the UI renders it but never enforces it alone.
 */

export const APPROVAL_LEVELS = [0, 1, 2, 3] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export const APPROVAL_LEVEL_NAMES: Record<ApprovalLevel, string> = {
  0: "Autonomous internal work",
  1: "Batch approval",
  2: "Explicit single-action approval",
  3: "Founder-only approval",
};

/** Catalogue of known action types mapped to their minimum approval level. */
export const ACTION_APPROVAL_LEVELS = {
  // Level 0 — autonomous internal work
  read_data: 0,
  research: 0,
  analyze: 0,
  create_draft: 0,
  create_internal_task: 0,
  generate_internal_report: 0,
  run_tests: 0,

  // Level 1 — batch approval
  external_outreach_campaign: 1,
  scheduled_content: 1,
  bulk_crm_change: 1,
  publish_nonsensitive_content: 1,

  // Level 2 — explicit single-action approval
  send_external_email: 2,
  price_change: 2,
  refund_exception: 2,
  supplier_commitment: 2,
  send_production_files: 2,
  purchase_order: 2,
  activate_paid_campaign: 2,
  accept_contract: 2,

  // Level 3 — founder-only
  new_brand_investment: 3,
  stage_gate_approval: 3,
  production_spend_above_threshold: 3,
  legal_claim: 3,
  equity_debt_ownership: 3,
  destructive_deletion: 3,
  security_credential_change: 3,
} as const satisfies Record<string, ApprovalLevel>;

export type ActionType = keyof typeof ACTION_APPROVAL_LEVELS;

export function requiredApprovalLevel(action: ActionType): ApprovalLevel {
  return ACTION_APPROVAL_LEVELS[action];
}

/** Level 0 actions may execute without an approval request; all others may not. */
export function requiresApproval(action: ActionType): boolean {
  return requiredApprovalLevel(action) > 0;
}

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "EXPIRED",
  "EXECUTED",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/**
 * Required contents of every approval request (spec §9). Workflows must build
 * this payload; incomplete requests fail validation before they are stored.
 */
export const approvalRequestContentSchema = z.object({
  proposedAction: z.string().min(1),
  actionType: z.enum(
    Object.keys(ACTION_APPROVAL_LEVELS) as [ActionType, ...ActionType[]],
  ),
  whyNow: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  costExposure: z.string().min(1),
  reversibility: z.enum(["REVERSIBLE", "IRREVERSIBLE"]),
  alternatives: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
  expiresAt: z.string().datetime().nullable().default(null),
});

export type ApprovalRequestContent = z.infer<typeof approvalRequestContentSchema>;

export const DECISION_OUTCOMES = [
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** Roles allowed to decide a request at a given level. */
export function canDecide(
  level: ApprovalLevel,
  role: "FOUNDER" | "OPERATOR" | "VIEWER",
): boolean {
  if (role === "VIEWER") return false;
  if (level === 3) return role === "FOUNDER";
  return true;
}
