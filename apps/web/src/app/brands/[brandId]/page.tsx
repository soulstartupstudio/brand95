import { prisma } from "@brand95/database";
import { getStage } from "@brand95/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function BrandOverviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      stages: {
        orderBy: { index: "asc" },
        include: { gate: { include: { criteria: true } } },
      },
      tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } },
      risks: { where: { status: "OPEN" }, orderBy: { severity: "desc" } },
      approvalRequests: { where: { status: "PENDING" } },
      artifacts: {
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
    },
  });
  if (!brand) notFound();

  const currentStage = brand.stages.find(
    (s) => s.index === brand.currentStageIndex,
  );
  const gate = currentStage?.gate;
  const met = gate?.criteria.filter((c) => c.status !== "PENDING").length ?? 0;

  return (
    <>
      <div className="grid cols-3">
        <div className="card">
          <div className="muted">Current stage</div>
          <h3>
            {brand.currentStageIndex}. {getStage(brand.currentStageIndex).name}
          </h3>
          <div className="muted">{getStage(brand.currentStageIndex).purpose}</div>
        </div>
        <div className="card">
          <div className="muted">Exit gate</div>
          <h3>
            {met}/{gate?.criteria.length ?? 0} criteria{" "}
            {gate && <StatusBadge status={gate.status} />}
          </h3>
          <Link className="muted" href={`/brands/${brand.id}/blueprint`}>
            Manage evidence and criteria →
          </Link>
        </div>
        <div className="card">
          <div className="muted">Open work</div>
          <h3>
            {brand.tasks.length} tasks · {brand.approvalRequests.length} approvals
          </h3>
          <div className="muted">
            {brand.risks.length} open risk{brand.risks.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <h2>Intake</h2>
      <div className="card">
        <dl className="kv">
          <dt>Concept</dt>
          <dd>{brand.concept}</dd>
          <dt>Problem / desire</dt>
          <dd>{brand.problem ?? "—"}</dd>
          <dt>Customer hypothesis</dt>
          <dd>{brand.customerHypothesis ?? "—"}</dd>
          <dt>Geography</dt>
          <dd>{brand.geography ?? "—"}</dd>
          <dt>Price range</dt>
          <dd>{brand.priceRange ?? "—"}</dd>
          <dt>Channel hypothesis</dt>
          <dd>{brand.channelHypothesis ?? "—"}</dd>
          <dt>Conviction</dt>
          <dd>{brand.convictionStatement ?? "—"}</dd>
          <dt>Budget / exposure</dt>
          <dd>
            {brand.startingBudget ?? "—"} · max inventory{" "}
            {brand.maxInventoryExposure ?? "—"}
          </dd>
        </dl>
      </div>

      {brand.risks.length > 0 && (
        <>
          <h2>Open risks</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Severity</th>
                <th>Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {brand.risks.map((risk) => (
                <tr key={risk.id}>
                  <td>{risk.title}</td>
                  <td>
                    <StatusBadge
                      status={risk.severity === "CRITICAL" || risk.severity === "HIGH" ? "BLOCKED" : "PENDING"}
                    />{" "}
                    {risk.severity}
                  </td>
                  <td className="muted">{risk.mitigation ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {brand.artifacts.length > 0 && (
        <>
          <h2>Recent artifacts</h2>
          {brand.artifacts.map((a) => (
            <div key={a.id} className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 15 }}>{a.title}</h3>
              <div className="muted">
                {a.kind} · v{a.currentVersion} · by {a.versions[0]?.createdBy ?? "—"}
              </div>
              {a.versions[0]?.content && (
                <details style={{ marginTop: 8 }}>
                  <summary className="muted" style={{ cursor: "pointer" }}>
                    Read document
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13.5,
                      fontFamily: "var(--font)",
                      background: "var(--surface-2)",
                      padding: 14,
                      borderRadius: 8,
                      maxHeight: 480,
                      overflowY: "auto",
                    }}
                  >
                    {a.versions[0].content}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}
