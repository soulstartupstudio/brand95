import { prisma } from "@brand95/database";
import { AGENTS, type AgentKey, type AgentResult } from "@brand95/domain";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function BrandAgentsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { agentRuns: { orderBy: { createdAt: "desc" } } },
  });
  if (!brand) notFound();

  return (
    <>
      <p className="muted">
        Agents coordinate through structured handoffs stored on each run; the
        database and event log are authoritative. The live agent runtime (CEO
        orchestration, parallel spawns) arrives in Milestone 3 — runs shown
        here are the persisted record.
      </p>

      {brand.agentRuns.length === 0 && (
        <div className="empty-state">No agent runs yet for this brand.</div>
      )}

      {brand.agentRuns.map((run) => {
        const agent = AGENTS[run.agentKey as AgentKey];
        const result = run.result as unknown as AgentResult | null;
        return (
          <div key={run.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <h3>
                {agent?.name ?? run.agentKey}
                <span className="muted" style={{ fontWeight: 400 }}>
                  {" "}
                  — {run.objective}
                </span>
              </h3>
              <StatusBadge status={run.status} />
            </div>
            {agent && <div className="muted">KPI: {agent.primaryKpi}</div>}
            {result && (
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Summary</dt>
                <dd>{result.summary}</dd>
                {result.evidence.length > 0 && (
                  <>
                    <dt>Evidence</dt>
                    <dd>{result.evidence.join(" · ")}</dd>
                  </>
                )}
                {result.risks.length > 0 && (
                  <>
                    <dt>Risks</dt>
                    <dd>{result.risks.join(" · ")}</dd>
                  </>
                )}
                <dt>Next action</dt>
                <dd>{result.next_recommended_action}</dd>
              </dl>
            )}
            {run.error && <div className="error-text">{run.error}</div>}
          </div>
        );
      })}
    </>
  );
}
