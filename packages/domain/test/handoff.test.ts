import { describe, expect, it } from "vitest";
import { agentHandoffSchema, agentResultSchema } from "../src/handoff";

const handoff = {
  handoff_id: "6b1f7db4-8b1a-4c8e-9a51-0f6f9d6a2f10",
  brand_id: "f3b9c1de-2f34-4f6a-8f21-9f1d3c5b7a90",
  from_agent: "research",
  to_agent: "brand_builder",
  objective: "Create positioning routes from approved opportunity research",
  inputs: [{ type: "artifact", id: "artifact-1", version: 3 }],
  constraints: ["Target retail price €29-€35", "EU launch first"],
  required_outputs: ["positioning_routes", "recommendation", "open_questions"],
  acceptance_criteria: ["Three materially distinct routes"],
  due_at: null,
  created_at: "2026-07-26T12:00:00Z",
  status: "queued",
};

describe("agent handoff schema", () => {
  it("accepts the spec example shape", () => {
    expect(agentHandoffSchema.parse(handoff).status).toBe("queued");
  });

  it("rejects unknown agents and missing objectives", () => {
    expect(
      agentHandoffSchema.safeParse({ ...handoff, to_agent: "intern" }).success,
    ).toBe(false);
    expect(
      agentHandoffSchema.safeParse({ ...handoff, objective: "" }).success,
    ).toBe(false);
  });
});

describe("agent result schema", () => {
  it("accepts a completed result with a required decision", () => {
    const result = agentResultSchema.parse({
      task_id: "6b1f7db4-8b1a-4c8e-9a51-0f6f9d6a2f10",
      agent: "brand_builder",
      status: "completed",
      summary: "Created three positioning routes and recommends Route B.",
      outputs: [{ type: "artifact", id: "artifact-2", version: 1 }],
      decisions_required: [{ type: "approval", question: "Approve Route B?" }],
      next_recommended_action: "Founder reviews positioning routes",
      completed_at: "2026-07-26T13:00:00Z",
    });
    expect(result.decisions_required).toHaveLength(1);
    expect(result.evidence).toEqual([]);
  });
});
