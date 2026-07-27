import { prisma } from "@brand95/database";
import { checkPortfolioDiscipline, getStage } from "@brand95/domain";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import { generateCeoReviewAction } from "@/lib/actions";
import { getCurrentContext } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const ctx = await getCurrentContext();
  if (!ctx) {
    return (
      <div className="empty-state">
        <h2>Welcome to Brand95 OS</h2>
        <p>
          No workspace exists yet. Run <code className="mono">pnpm db:seed</code>{" "}
          to create the Brand95 workspace with the Camera95, Crossbody, Standard
          Dental, and Hold candidates — or create your first brand.
        </p>
        <p>
          <Link className="btn primary" href="/brands/new">
            Create new brand
          </Link>
        </p>
      </div>
    );
  }

  const [brands, pendingApprovals] = await Promise.all([
    prisma.brand.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        stages: {
          include: { gate: { include: { criteria: true } } },
        },
        tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } },
        risks: { where: { status: "OPEN", severity: { in: ["HIGH", "CRITICAL"] } } },
      },
    }),
    prisma.approvalRequest.findMany({
      where: { workspaceId: ctx.workspace.id, status: "PENDING" },
      include: { brand: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const ceoReview = await prisma.artifact.findFirst({
    where: { workspaceId: ctx.workspace.id, brandId: null, kind: "ceo_review" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const warnings = checkPortfolioDiscipline(
    brands.map((b) => ({
      id: b.id,
      name: b.name,
      currentStageIndex: b.currentStageIndex,
      status: b.status,
    })),
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Portfolio</h1>
          <div className="sub">
            {brands.filter((b) => b.status === "ACTIVE").length} active brands ·{" "}
            {pendingApprovals.length} approval
            {pendingApprovals.length === 1 ? "" : "s"} waiting
          </div>
        </div>
        <Link className="btn primary" href="/brands/new">
          + Create new brand
        </Link>
      </div>

      {warnings.map((w) => (
        <div key={w.code} className="warning-banner">
          <strong>Portfolio discipline:</strong> {w.message}{" "}
          <span className="muted">({w.brandNames.join(", ")})</span>
        </div>
      ))}

      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h3>Weekly CEO review</h3>
            <div className="muted">
              {ceoReview
                ? `Latest: v${ceoReview.currentVersion}, ${ceoReview.updatedAt.toISOString().slice(0, 10)}`
                : "Not generated yet — the CEO Orchestrator reviews every brand, finds the biggest bottleneck, and recommends at most three priorities each."}
            </div>
          </div>
          <ActionForm action={generateCeoReviewAction} className="inline-form">
            <button className="btn">Generate review</button>
          </ActionForm>
        </div>
        {ceoReview?.versions[0]?.content && (
          <details style={{ marginTop: 10 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Read the briefing
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
              {ceoReview.versions[0].content}
            </pre>
          </details>
        )}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Next decisions</h3>
          {pendingApprovals.map((req) => {
            const content = req.content as { proposedAction?: string };
            return (
              <div key={req.id} className="criterion">
                <span>
                  {req.brand && <strong>{req.brand.name}: </strong>}
                  {content.proposedAction ?? req.actionType}
                </span>
                <Link className="btn small" href="/approvals">
                  Review
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid cols-2">
        {brands.map((brand) => {
          const stageDef = getStage(brand.currentStageIndex);
          const currentStage = brand.stages.find(
            (s) => s.index === brand.currentStageIndex,
          );
          const gate = currentStage?.gate;
          const metCount =
            gate?.criteria.filter((c) => c.status !== "PENDING").length ?? 0;
          const critCount = gate?.criteria.length ?? 0;
          const bottleneck =
            brand.status !== "ACTIVE"
              ? `Brand is ${brand.status.toLowerCase()}`
              : gate?.status === "READY"
                ? "Gate ready — founder decision needed"
                : `Gate criteria: ${metCount}/${critCount} · ${brand.tasks.length} open tasks`;
          return (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3>{brand.name}</h3>
                  <span style={{ display: "flex", gap: 6 }}>
                    {brand.route && <StatusBadge status={brand.route} />}
                    <StatusBadge status={brand.status} />
                  </span>
                </div>
                <div className="muted">{brand.concept}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge blue">
                    Stage {brand.currentStageIndex}: {stageDef.name}
                  </span>
                  {gate && <StatusBadge status={gate.status} />}
                </div>
                <div className="muted" style={{ marginTop: 10 }}>
                  <strong style={{ color: "var(--text)" }}>Bottleneck:</strong>{" "}
                  {bottleneck}
                  {brand.risks.length > 0 && (
                    <> · {brand.risks.length} high risk{brand.risks.length > 1 ? "s" : ""} open</>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {brands.length === 0 && (
        <div className="empty-state">
          No brands yet. Create the first one — the wizard sets up the full
          Blueprint automatically.
        </div>
      )}
    </>
  );
}
