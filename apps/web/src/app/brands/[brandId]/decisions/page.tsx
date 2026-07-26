import { prisma } from "@brand95/database";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

const OUTCOME_COLOR: Record<string, string> = {
  PROCEED: "DONE",
  REACTIVATE: "DONE",
  ROUTE_DUAL: "IN_PROGRESS",
  PARK: "WAIVED",
  REVISE: "WAIVED",
  REJECT: "BLOCKED",
};

export default async function BrandDecisionsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      decisions: {
        orderBy: { createdAt: "desc" },
        include: { decidedBy: true },
      },
    },
  });
  if (!brand) notFound();

  if (brand.decisions.length === 0) {
    return (
      <div className="empty-state">
        No decisions logged yet. Stage-gate approvals, route choices, and
        park/reject calls all land here.
      </div>
    );
  }

  return (
    <table className="data">
      <thead>
        <tr>
          <th>Decision</th>
          <th>Outcome</th>
          <th>Rationale</th>
          <th>By</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        {brand.decisions.map((d) => (
          <tr key={d.id}>
            <td>{d.title}</td>
            <td>
              <StatusBadge status={OUTCOME_COLOR[d.outcome] ?? d.outcome} />
              <span className="muted" style={{ marginLeft: 6 }}>{d.outcome}</span>
            </td>
            <td className="muted">{d.rationale ?? "—"}</td>
            <td>{d.decidedBy?.name ?? "—"}</td>
            <td className="muted">{d.createdAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
