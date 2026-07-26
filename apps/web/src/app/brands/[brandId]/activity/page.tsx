import { prisma } from "@brand95/database";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BrandActivityPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) notFound();

  const events = await prisma.event.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (events.length === 0) {
    return <div className="empty-state">No activity recorded yet.</div>;
  }

  return (
    <>
      <p className="muted">
        Append-only event log — every meaningful state change, with actor and
        payload. {events.length === 100 ? "Showing the latest 100." : ""}
      </p>
      {events.map((event) => (
        <div key={event.id} className="event-row">
          <span className="time">
            {event.createdAt.toISOString().replace("T", " ").slice(0, 16)}
          </span>
          <span className="badge gray">{event.actorType}</span>
          <span>
            <strong>{event.verb}</strong>{" "}
            <span className="muted">
              {event.entityType}
              {event.payload ? ` — ${JSON.stringify(event.payload)}` : ""}
            </span>
          </span>
        </div>
      ))}
    </>
  );
}
