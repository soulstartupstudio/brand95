import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";

/**
 * LLM access for Brand95 agents.
 *
 * - With ANTHROPIC_API_KEY set, calls Claude (model from ANTHROPIC_MODEL,
 *   default claude-opus-5) with structured JSON outputs validated against the
 *   caller's zod schema.
 * - Without a key, runs in MOCK mode: the caller's deterministic mock output
 *   is returned instead, so every workflow stays fully clickable in demos and
 *   tests with zero credentials.
 */

export type LlmMode = "live" | "mock";

export function llmMode(): LlmMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "mock";
}

export function llmModel(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  _client ??= new Anthropic();
  return _client;
}

export class LlmRefusalError extends Error {
  constructor(public category: string | null) {
    super(
      `The model declined this request (category: ${category ?? "unspecified"}).`,
    );
    this.name = "LlmRefusalError";
  }
}

export interface StructuredCall<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Deterministic output used when no API key is configured. */
  mock: () => T;
  maxTokens?: number;
}

export async function generateStructured<T>(call: StructuredCall<T>): Promise<T> {
  if (llmMode() === "mock") {
    return call.schema.parse(call.mock());
  }

  const response = await client().messages.parse({
    model: llmModel(),
    max_tokens: call.maxTokens ?? 16000,
    system: call.system,
    messages: [{ role: "user", content: call.prompt }],
    output_config: {
      format: zodOutputFormat(call.schema),
    },
  });

  if (response.stop_reason === "refusal") {
    throw new LlmRefusalError(response.stop_details?.category ?? null);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Model output was truncated (max_tokens). Retry or raise the limit.",
    );
  }
  if (response.parsed_output == null) {
    throw new Error("Model returned no parseable structured output.");
  }
  return call.schema.parse(response.parsed_output);
}
