import { z } from "zod";
import { AGENT_KEYS } from "./agents";

/**
 * Standard structured payloads for agent coordination (spec §4). Agents
 * coordinate through the database and event log; these schemas validate the
 * handoff and result objects stored on AgentRun rows.
 */

const agentKeySchema = z.enum(AGENT_KEYS);

export const handoffInputSchema = z.object({
  type: z.enum(["artifact", "record", "url", "text"]),
  id: z.string().min(1),
  version: z.number().int().positive().optional(),
});

export const agentHandoffSchema = z.object({
  handoff_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  from_agent: agentKeySchema,
  to_agent: agentKeySchema,
  objective: z.string().min(1),
  inputs: z.array(handoffInputSchema).default([]),
  constraints: z.array(z.string()).default([]),
  required_outputs: z.array(z.string()).min(1),
  acceptance_criteria: z.array(z.string()).default([]),
  due_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
  status: z.enum(["queued", "in_progress", "completed", "failed", "cancelled"]),
});

export type AgentHandoff = z.infer<typeof agentHandoffSchema>;

export const agentResultSchema = z.object({
  task_id: z.string().uuid(),
  agent: agentKeySchema,
  status: z.enum(["completed", "failed", "needs_input"]),
  summary: z.string().min(1),
  outputs: z
    .array(
      z.object({
        type: z.enum(["artifact", "record", "url", "text"]),
        id: z.string().min(1),
        version: z.number().int().positive().optional(),
      }),
    )
    .default([]),
  evidence: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  decisions_required: z
    .array(
      z.object({
        type: z.enum(["approval", "choice", "information"]),
        question: z.string().min(1),
      }),
    )
    .default([]),
  next_recommended_action: z.string().min(1),
  completed_at: z.string().datetime().nullable().default(null),
});

export type AgentResult = z.infer<typeof agentResultSchema>;
