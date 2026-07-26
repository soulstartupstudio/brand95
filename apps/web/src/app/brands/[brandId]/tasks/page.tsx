import { prisma } from "@brand95/database";
import { AGENTS, type AgentKey } from "@brand95/domain";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function BrandTasksPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      tasks: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: { stage: true, workstream: true },
      },
    },
  });
  if (!brand) notFound();

  if (brand.tasks.length === 0) {
    return <div className="empty-state">No tasks yet.</div>;
  }

  return (
    <table className="data">
      <thead>
        <tr>
          <th>Task</th>
          <th>Stage</th>
          <th>Owner</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {brand.tasks.map((task) => (
          <tr key={task.id}>
            <td>
              {task.title}
              {task.description && (
                <div className="muted">{task.description}</div>
              )}
            </td>
            <td className="muted">
              {task.stage ? `${task.stage.index}. ${task.stage.name}` : "—"}
            </td>
            <td>
              {task.assigneeAgent ? (
                <span className="badge purple">
                  {AGENTS[task.assigneeAgent as AgentKey]?.name ?? task.assigneeAgent}
                </span>
              ) : (
                <span className="muted">Founder</span>
              )}
            </td>
            <td>
              <StatusBadge status={task.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
