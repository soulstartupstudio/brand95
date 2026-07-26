import { prisma } from "@brand95/database";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import {
  addEvidence,
  requestGateApprovalAction,
  updateCriterion,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function BrandBlueprintPage({
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
        include: {
          gate: {
            include: {
              criteria: { include: { evidence: { orderBy: { createdAt: "desc" } } } },
              approvalRequest: true,
            },
          },
        },
      },
    },
  });
  if (!brand) notFound();

  return (
    <>
      {brand.stages.map((stage) => {
        const isCurrent = stage.index === brand.currentStageIndex;
        const gate = stage.gate;
        return (
          <div key={stage.id} className="stage-row">
            <div
              className={`stage-num ${
                stage.status === "COMPLETE"
                  ? "complete"
                  : stage.status === "ACTIVE"
                    ? "active"
                    : ""
              }`}
            >
              {stage.index}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{stage.name}</h3>
                <StatusBadge status={stage.status} />
                {gate && isCurrent && <StatusBadge status={gate.status} />}
              </div>
              <div className="muted">{stage.purpose}</div>

              {isCurrent && gate && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: 14 }}>Exit gate criteria</h3>
                  {gate.criteria.map((criterion) => (
                    <div key={criterion.id} className="criterion">
                      <div style={{ flex: 1 }}>
                        <div>
                          {criterion.label}{" "}
                          {criterion.founderJudgment && (
                            <span className="badge red">founder</span>
                          )}{" "}
                          <StatusBadge status={criterion.status} />
                        </div>
                        {criterion.evidenceTarget && (
                          <div className="muted">
                            Target: {criterion.evidenceTarget}
                          </div>
                        )}
                        {criterion.status === "WAIVED" && criterion.waivedReason && (
                          <div className="muted">
                            Waived: {criterion.waivedReason}
                          </div>
                        )}
                        {criterion.evidence.length > 0 && (
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                            {criterion.evidence.map((e) => (
                              <li key={e.id}>
                                <span className="badge gray">{e.type.replaceAll("_", " ")}</span>{" "}
                                {e.source}
                                {e.note && <span className="muted"> — {e.note}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        <details style={{ marginTop: 6 }}>
                          <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
                            Add evidence
                          </summary>
                          <ActionForm action={addEvidence} className="inline-form">
                            <input type="hidden" name="criterionId" value={criterion.id} />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <select name="type" defaultValue="CUSTOMER_SIGNAL">
                              <option value="CUSTOMER_SIGNAL">Customer signal</option>
                              <option value="INTERVIEW">Interview</option>
                              <option value="RETAILER_SIGNAL">Retailer signal</option>
                              <option value="METRIC">Metric</option>
                              <option value="DOCUMENT">Document</option>
                              <option value="LINK">Link</option>
                              <option value="NOTE">Note</option>
                            </select>
                            <input type="text" name="source" placeholder="Source" style={{ width: 200 }} />
                            <input type="text" name="note" placeholder="Note (optional)" style={{ width: 200 }} />
                            <button className="btn small">Record</button>
                          </ActionForm>
                        </details>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        {criterion.status !== "MET" && (
                          <ActionForm action={updateCriterion} className="inline-form">
                            <input type="hidden" name="criterionId" value={criterion.id} />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <input type="hidden" name="status" value="MET" />
                            <button className="btn small">Mark met</button>
                          </ActionForm>
                        )}
                        {criterion.status === "PENDING" && (
                          <ActionForm action={updateCriterion} className="inline-form">
                            <input type="hidden" name="criterionId" value={criterion.id} />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <input type="hidden" name="status" value="WAIVED" />
                            <input
                              type="text"
                              name="waivedReason"
                              placeholder="Waiver reason (required)"
                              style={{ width: 170 }}
                            />
                            <button className="btn small">Waive</button>
                          </ActionForm>
                        )}
                        {criterion.status !== "PENDING" && (
                          <ActionForm action={updateCriterion} className="inline-form">
                            <input type="hidden" name="criterionId" value={criterion.id} />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <input type="hidden" name="status" value="PENDING" />
                            <button className="btn small">Reset</button>
                          </ActionForm>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 14 }}>
                    {gate.status === "PASSED" ? (
                      <span className="badge green">Gate passed</span>
                    ) : gate.approvalRequest?.status === "PENDING" ? (
                      <span className="badge amber">
                        Founder approval pending — see the approval inbox
                      </span>
                    ) : gate.status === "READY" ? (
                      <ActionForm action={requestGateApprovalAction} className="inline-form">
                        <input type="hidden" name="gateId" value={gate.id} />
                        <input type="hidden" name="brandId" value={brand.id} />
                        <button className="btn primary">
                          Request founder gate approval (Level 3)
                        </button>
                      </ActionForm>
                    ) : (
                      <span className="muted">
                        Gate not ready — every criterion must be met or waived
                        with a reason before an approval can be requested.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
