import { llmMode, llmModel, STAGE_PLANS } from "@brand95/agents";
import { prisma } from "@brand95/database";
import {
  AGENTS,
  getStage,
  type AgentKey,
  type AgentResult,
} from "@brand95/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import { draftOutreachAction, runStageAgentsAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // real agent runs can take minutes

export default async function BrandAgentsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      agentRuns: { orderBy: { createdAt: "desc" }, take: 20 },
      outreachMessages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!brand) notFound();

  const mode = llmMode();

  return (
    <>
      {mode === "mock" ? (
        <div className="warning-banner">
          <strong>Mock mode:</strong> no <code className="mono">ANTHROPIC_API_KEY</code>{" "}
          is configured, so agents return labeled placeholder output. Add a key
          to <code className="mono">.env</code> (get one at console.anthropic.com) and
          restart to get real research, memos, and outreach drafts.
        </div>
      ) : (
        <p className="muted">
          Agents run on <code className="mono">{llmModel()}</code>. Runs can take a
          few minutes; the page updates when they finish.
        </p>
      )}

      <div className="grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          {(() => {
            const plan = STAGE_PLANS[brand.currentStageIndex];
            const stageDef = getStage(brand.currentStageIndex);
            return (
              <>
                <h3>Run {stageDef.name} agents</h3>
                <p className="muted">
                  {plan ? (
                    <>
                      The CEO Orchestrator spawns{" "}
                      {plan.specialists
                        .map((s) => AGENTS[s.key].name)
                        .join(", ")}{" "}
                      in parallel, saves each deliverable, attaches evidence to
                      this stage&apos;s gate, and consolidates{" "}
                      <em>{plan.consolidatedTitle(brand.name)}</em> with a
                      proceed/revise/park/reject recommendation.
                    </>
                  ) : (
                    "Agents run from Stage 1 (Discover) onward — complete the Intake gate first."
                  )}
                </p>
                <ActionForm action={runStageAgentsAction} className="inline-form">
                  <input type="hidden" name="brandId" value={brand.id} />
                  <button
                    className="btn primary"
                    disabled={!plan || brand.status !== "ACTIVE"}
                  >
                    Run {stageDef.name} agents
                  </button>
                </ActionForm>
              </>
            );
          })()}
        </div>
        <div className="card">
          <h3>Draft retail outreach</h3>
          <p className="muted">
            The Retail agent drafts personalized wholesale emails. Nothing is
            sent: the batch lands in the approval inbox (Level 1), and sending
            is executed only after you approve it.
          </p>
          <ActionForm action={draftOutreachAction} className="inline-form">
            <input type="hidden" name="brandId" value={brand.id} />
            <select name="count" defaultValue="5">
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} drafts
                </option>
              ))}
            </select>
            <button className="btn primary" disabled={brand.status !== "ACTIVE"}>
              Draft batch
            </button>
          </ActionForm>
        </div>
      </div>

      <h2>Agent runs</h2>
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
            {result && (
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Summary</dt>
                <dd>{result.summary}</dd>
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

      {brand.outreachMessages.length > 0 && (
        <>
          <h2>Outreach drafts</h2>
          <p className="muted">
            Pending batches are decided in the{" "}
            <Link href="/approvals" style={{ textDecoration: "underline" }}>
              approval inbox
            </Link>
            ; approved batches get an Execute button there.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {brand.outreachMessages.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.prospectName}
                    <div className="muted">{m.prospectType}</div>
                  </td>
                  <td>
                    <details>
                      <summary style={{ cursor: "pointer" }}>{m.subject}</summary>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                          background: "var(--surface-2)",
                          padding: 10,
                          borderRadius: 8,
                        }}
                      >
                        {m.body}
                      </pre>
                      {m.personalizationBasis && (
                        <div className="muted">
                          Personalization: {m.personalizationBasis}
                        </div>
                      )}
                    </details>
                  </td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="muted">
                    {m.sentAt ? m.sentAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                    {m.provider === "mock" && m.status === "SENT" && (
                      <div className="muted">(mock send)</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
