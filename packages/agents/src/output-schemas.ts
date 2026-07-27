import { z } from "zod/v4";

/**
 * Structured-output contracts for agent LLM calls. Kept free of uuid/datetime
 * formats and defaults so they translate cleanly to strict JSON schemas; the
 * workflow layer wraps results into the stored AgentResult shape afterwards.
 */

/** Generic specialist deliverable: a markdown artifact plus structured findings. */
export const specialistOutputSchema = z.object({
  summary: z.string().describe("One or two sentences on what was produced."),
  artifact_title: z.string(),
  artifact_markdown: z
    .string()
    .describe(
      "The full deliverable as markdown. Separate facts, estimates, hypotheses, and recommendations under explicit headings.",
    ),
  evidence: z
    .array(z.string())
    .describe("Concrete evidence items backing the findings, with sources where known."),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  open_questions: z.array(z.string()),
  next_recommended_action: z.string(),
});

export type SpecialistOutput = z.infer<typeof specialistOutputSchema>;

/** CEO consolidation: the Opportunity Memo plus a recommendation. */
export const opportunityMemoSchema = z.object({
  summary: z.string(),
  memo_markdown: z
    .string()
    .describe(
      "The consolidated Opportunity Memo in markdown: opportunity, customer, competition, price architecture, unit economics, retail landscape, risks — separating facts, estimates, and hypotheses.",
    ),
  recommendation: z.enum(["proceed", "revise", "park", "reject"]),
  recommendation_rationale: z.string(),
  missing_evidence: z
    .array(z.string())
    .describe("What is still missing before the Discover gate criteria can be met."),
  next_recommended_action: z.string(),
});

export type OpportunityMemo = z.infer<typeof opportunityMemoSchema>;

/** Retail outreach drafting: personalized drafts, never sent without approval. */
export const outreachBatchSchema = z.object({
  summary: z.string(),
  drafts: z.array(
    z.object({
      prospect_name: z.string().describe("Store or buyer name"),
      prospect_type: z.string().describe("e.g. concept store, museum shop, boutique"),
      email_subject: z.string(),
      email_body: z
        .string()
        .describe("Complete, personalized outreach email body, ready to send after approval."),
      personalization_basis: z
        .string()
        .describe("What verified detail this draft's personalization relies on."),
    }),
  ),
  assumptions: z.array(z.string()),
  next_recommended_action: z.string(),
});

export type OutreachBatch = z.infer<typeof outreachBatchSchema>;
