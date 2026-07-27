import type { Brand } from "@brand95/database";
import type { AgentKey } from "@brand95/domain";
import type {
  OpportunityMemo,
  OutreachBatch,
  SpecialistOutput,
} from "./output-schemas";

/**
 * Deterministic outputs used when no ANTHROPIC_API_KEY is configured (mock
 * mode) and in tests. Clearly labeled so nobody mistakes them for research.
 */

const MOCK_NOTE =
  "> **Mock mode** — generated without an AI model. Add ANTHROPIC_API_KEY to .env for real agent output.\n\n";

export function mockSpecialistOutput(
  agentKey: AgentKey,
  brand: Brand,
): SpecialistOutput {
  const titles: Partial<Record<AgentKey, string>> = {
    research: `${brand.name} — Customer & Competitor Research (draft)`,
    retail: `${brand.name} — Retail Landscape Scan (draft)`,
    product: `${brand.name} — Product Feasibility Brief (draft)`,
    finance: `${brand.name} — Initial Unit Economics (draft)`,
  };
  return {
    summary: `Mock ${agentKey} deliverable for ${brand.name} (no API key configured).`,
    artifact_title: titles[agentKey] ?? `${brand.name} — ${agentKey} output (draft)`,
    artifact_markdown:
      MOCK_NOTE +
      `# ${titles[agentKey] ?? agentKey}\n\n## Facts\n- Placeholder: no research was performed in mock mode.\n\n## Estimates\n- Placeholder estimate pending a live agent run.\n\n## Hypotheses\n- ${brand.concept}\n\n## Recommendations\n- Configure an Anthropic API key and re-run Discover for real output.`,
    evidence: ["Mock mode: no evidence gathered"],
    assumptions: ["Running without an AI model configured"],
    risks: ["Do not base decisions on mock output"],
    open_questions: ["Re-run with a real model"],
    next_recommended_action: "Add ANTHROPIC_API_KEY to .env and re-run Discover.",
  };
}

export function mockOpportunityMemo(brand: Brand): OpportunityMemo {
  return {
    summary: `Mock Opportunity Memo for ${brand.name}.`,
    memo_markdown:
      MOCK_NOTE +
      `# ${brand.name} Opportunity Memo (mock)\n\n## Opportunity\n${brand.concept}\n\n## Recommendation\nRevise — this memo was generated in mock mode and contains no real research.`,
    recommendation: "revise",
    recommendation_rationale:
      "Mock mode produced no real evidence; run with a configured model before deciding.",
    missing_evidence: [
      "All Discover gate evidence (mock mode gathered nothing)",
    ],
    next_recommended_action:
      "Configure ANTHROPIC_API_KEY and re-run the Discover research workflow.",
  };
}

export function mockOutreachBatch(brand: Brand, count: number): OutreachBatch {
  return {
    summary: `Mock outreach batch of ${count} drafts for ${brand.name}.`,
    drafts: Array.from({ length: count }, (_, i) => ({
      prospect_name: `Example Store ${i + 1}`,
      prospect_type: "concept store",
      email_subject: `[MOCK] Introducing ${brand.name}`,
      email_body: `Hi Example Store ${i + 1} team,\n\nThis is a mock outreach draft generated without an AI model. Configure ANTHROPIC_API_KEY for real, personalized drafts.\n\n— ${brand.name}`,
      personalization_basis: "None — mock mode",
    })),
    assumptions: ["Mock mode: prospects are placeholders, not real stores"],
    next_recommended_action:
      "Configure ANTHROPIC_API_KEY, then re-draft with real prospect research.",
  };
}
