import { describe, expect, it } from "vitest";
import {
  approvalRequestContentSchema,
  canDecide,
  requiredApprovalLevel,
  requiresApproval,
} from "../src/approvals";

describe("approval policy", () => {
  it("maps action types to spec levels", () => {
    expect(requiredApprovalLevel("create_draft")).toBe(0);
    expect(requiredApprovalLevel("external_outreach_campaign")).toBe(1);
    expect(requiredApprovalLevel("purchase_order")).toBe(2);
    expect(requiredApprovalLevel("send_external_email")).toBe(2);
    expect(requiredApprovalLevel("stage_gate_approval")).toBe(3);
    expect(requiredApprovalLevel("destructive_deletion")).toBe(3);
  });

  it("only level 0 actions run without approval", () => {
    expect(requiresApproval("research")).toBe(false);
    expect(requiresApproval("send_external_email")).toBe(true);
  });

  it("restricts level 3 decisions to the founder", () => {
    expect(canDecide(3, "FOUNDER")).toBe(true);
    expect(canDecide(3, "OPERATOR")).toBe(false);
    expect(canDecide(2, "OPERATOR")).toBe(true);
    expect(canDecide(1, "VIEWER")).toBe(false);
  });
});

describe("approvalRequestContentSchema", () => {
  const valid = {
    proposedAction: "Send outreach batch of 10 emails to Benelux concept stores",
    actionType: "external_outreach_campaign",
    whyNow: "Retail validation stage requires 50 qualified prospects contacted",
    evidence: ["Prospect list artifact v2", "Fit scores ≥ 80"],
    costExposure: "No direct cost; brand reputation exposure on 10 contacts",
    reversibility: "IRREVERSIBLE",
    alternatives: ["Wait for more fit scoring", "Smaller batch of 5"],
    recommendation: "Approve; personalization verified on all 10",
    expiresAt: null,
  };

  it("accepts a complete request", () => {
    expect(approvalRequestContentSchema.parse(valid).actionType).toBe(
      "external_outreach_campaign",
    );
  });

  it("rejects requests missing required spec fields", () => {
    for (const field of [
      "proposedAction",
      "whyNow",
      "costExposure",
      "reversibility",
      "recommendation",
    ]) {
      const broken: Record<string, unknown> = { ...valid };
      delete broken[field];
      expect(approvalRequestContentSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("rejects unknown action types", () => {
    expect(
      approvalRequestContentSchema.safeParse({ ...valid, actionType: "yolo" })
        .success,
    ).toBe(false);
  });
});
