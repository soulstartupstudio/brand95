import { runStageAgents } from "./engine";

/**
 * Back-compat wrapper: Discover research is the Stage 1 case of the
 * stage-aware engine (see engine.ts / STAGE_PLANS).
 */
export async function runDiscoverResearch(input: {
  brandId: string;
  requestedBy: string;
}) {
  const result = await runStageAgents(input);
  return { ...result, memoArtifactId: result.reportArtifactId };
}
