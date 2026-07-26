import { prisma } from "@brand95/database";
import type { ApprovalRequestContent } from "@brand95/domain";
import Link from "next/link";
import { LevelBadge, StatusBadge } from "@/components/badges";
import { ActionForm } from "@/components/action-form";
import { decideApprovalAction } from "@/lib/actions";
import { getCurrentContext } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await getCurrentContext();
  if (!ctx) {
    return <div className="empty-state">Run the seed first (`pnpm db:seed`).</div>;
  }

  const [pending, recent] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { workspaceId: ctx.workspace.id, status: "PENDING" },
      include: { brand: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.approvalRequest.findMany({
      where: { workspaceId: ctx.workspace.id, status: { not: "PENDING" } },
      include: { brand: true, decision: { include: { decidedBy: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Approval inbox</h1>
          <div className="sub">
            Draft first, approve, then execute. Nothing consequential happens
            without a decision here.
          </div>
        </div>
      </div>

      {pending.length === 0 && (
        <div className="empty-state">No approvals waiting. All clear.</div>
      )}

      {pending.map((req) => {
        const content = req.content as unknown as ApprovalRequestContent;
        return (
          <div key={req.id} className="card" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <h3 style={{ maxWidth: "70%" }}>{content.proposedAction}</h3>
              <span style={{ display: "flex", gap: 6 }}>
                <LevelBadge level={req.level} />
                {req.brand && (
                  <Link href={`/brands/${req.brand.id}`}>
                    <span className="badge blue">{req.brand.name}</span>
                  </Link>
                )}
              </span>
            </div>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Why now</dt>
              <dd>{content.whyNow}</dd>
              <dt>Cost / exposure</dt>
              <dd>{content.costExposure}</dd>
              <dt>Reversibility</dt>
              <dd>
                <StatusBadge
                  status={content.reversibility === "IRREVERSIBLE" ? "BLOCKED" : "DONE"}
                />{" "}
                {content.reversibility.toLowerCase()}
              </dd>
              <dt>Evidence</dt>
              <dd>
                {content.evidence.length === 0 ? (
                  <span className="muted">None recorded</span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {content.evidence.slice(0, 6).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {content.evidence.length > 6 && (
                      <li className="muted">
                        …and {content.evidence.length - 6} more
                      </li>
                    )}
                  </ul>
                )}
              </dd>
              <dt>Alternatives</dt>
              <dd>{content.alternatives.join(" · ") || "—"}</dd>
              <dt>Recommendation</dt>
              <dd>{content.recommendation}</dd>
              <dt>Requested by</dt>
              <dd className="mono">{req.requestedBy}</dd>
            </dl>
            <ActionForm action={decideApprovalAction} className="inline-form" >
              <input type="hidden" name="requestId" value={req.id} />
              <input
                type="text"
                name="note"
                placeholder="Decision note (optional)"
                style={{ width: 280 }}
              />
              <button className="btn primary" name="outcome" value="APPROVED">
                Approve
              </button>
              <button className="btn" name="outcome" value="CHANGES_REQUESTED">
                Request changes
              </button>
              <button className="btn danger" name="outcome" value="REJECTED">
                Reject
              </button>
            </ActionForm>
          </div>
        );
      })}

      {recent.length > 0 && (
        <>
          <h2>Recently decided</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Action</th>
                <th>Brand</th>
                <th>Status</th>
                <th>Decided by</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((req) => {
                const content = req.content as unknown as ApprovalRequestContent;
                return (
                  <tr key={req.id}>
                    <td>{content.proposedAction}</td>
                    <td>{req.brand?.name ?? "—"}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td>{req.decision?.decidedBy.name ?? "—"}</td>
                    <td className="muted">{req.decision?.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
