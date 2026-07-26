import { prisma } from "@brand95/database";
import { getStage } from "@brand95/domain";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import { TabNav } from "@/components/tab-nav";
import { setBrandStatus } from "@/lib/actions";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "blueprint", label: "Blueprint" },
  { slug: "tasks", label: "Tasks" },
  { slug: "agents", label: "Agents" },
  { slug: "decisions", label: "Decisions" },
  { slug: "activity", label: "Activity" },
];

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) notFound();

  const stageDef = getStage(brand.currentStageIndex);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brand.name}
            <StatusBadge status={brand.status} />
            {brand.route && <StatusBadge status={brand.route} />}
          </h1>
          <div className="sub">
            Stage {brand.currentStageIndex}: {stageDef.name} — {brand.concept}
          </div>
        </div>
        <div>
          {brand.status === "ACTIVE" ? (
            <ActionForm action={setBrandStatus} className="inline-form">
              <input type="hidden" name="brandId" value={brand.id} />
              <input type="hidden" name="status" value="PARKED" />
              <input
                type="text"
                name="rationale"
                placeholder="Why park it?"
                style={{ width: 180 }}
              />
              <button className="btn small">Park brand</button>
            </ActionForm>
          ) : (
            <ActionForm action={setBrandStatus} className="inline-form">
              <input type="hidden" name="brandId" value={brand.id} />
              <input type="hidden" name="status" value="ACTIVE" />
              <button className="btn small primary">Reactivate</button>
            </ActionForm>
          )}
        </div>
      </div>
      <TabNav base={`/brands/${brand.id}`} tabs={TABS} />
      {children}
    </>
  );
}
