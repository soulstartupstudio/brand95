import { all, get, insert, update, newId, now, logEvent, actor, byRef } from "../db/index.ts";
import { requireUnit } from "./portfolio.ts";
import type { Approval } from "../domain/types.ts";

export interface ApprovalInput {
  unit?: string | null;
  kind: Approval["kind"];
  title: string;
  proposal: string;
  why_now?: string;
  evidence?: string;
  exposure?: string;
  alternatives?: string;
  recommendation?: string;
  risk_level?: number;
  payload?: Record<string, unknown>;
  requested_by?: string;
}

/** Create an approval request. This is the only door to anything external or irreversible. */
export function requestApproval(input: ApprovalInput): Approval {
  const unit_id = input.unit ? requireUnit(input.unit).id : null;
  const row = {
    id: newId(), unit_id, kind: input.kind, title: input.title, proposal: input.proposal,
    why_now: input.why_now ?? null, evidence: input.evidence ?? null, exposure: input.exposure ?? null,
    alternatives: input.alternatives ?? null, recommendation: input.recommendation ?? null,
    risk_level: input.risk_level ?? 1, payload: JSON.stringify(input.payload ?? {}), status: "pending",
    requested_by: input.requested_by ?? actor(), note: null, created_at: now(), decided_at: null, executed_at: null,
  };
  insert("approvals", row);
  logEvent(row.requested_by, "approval.requested", { unit_id, ref_id: row.id, payload: { kind: row.kind, title: row.title, risk_level: row.risk_level } });
  return row as Approval;
}

export function getApproval(id: string): Approval | undefined {
  return byRef<Approval>("approvals", id);
}

export function listApprovals(status: string | "all" = "pending", unitRef?: string): Approval[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status !== "all") { clauses.push("status = ?"); params.push(status); }
  if (unitRef) { clauses.push("unit_id = ?"); params.push(requireUnit(unitRef).id); }
  return all<Approval>(`SELECT * FROM approvals ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY risk_level DESC, created_at`, ...params);
}

export function decideApproval(id: string, decision: "approved" | "rejected" | "changes_requested", note?: string): Approval {
  const a = getApproval(id);
  if (!a) throw new Error(`Unknown approval ${id}`);
  if (a.status !== "pending") throw new Error(`Approval ${a.id} is already ${a.status}`);
  update("approvals", a.id, { status: decision, note: note ?? null, decided_at: now() });
  logEvent(actor(), `approval.${decision}`, { unit_id: a.unit_id, ref_id: a.id, payload: { kind: a.kind, note } });
  const updated = getApproval(a.id)!;
  if (decision === "approved") applySideEffects(updated);
  return updated;
}

export function markExecuted(id: string, result?: Record<string, unknown>): Approval {
  const a = getApproval(id);
  if (!a) throw new Error(`Unknown approval ${id}`);
  if (a.status !== "approved") throw new Error(`Approval ${a.id} is ${a.status}, not approved`);
  update("approvals", a.id, { status: "executed", executed_at: now() });
  logEvent(actor(), "approval.executed", { unit_id: a.unit_id, ref_id: a.id, payload: result ?? {} });
  return getApproval(a.id)!;
}

/** Approval side effects: approving an outreach batch flips its drafts to 'approved' so they can be sent. */
function applySideEffects(a: Approval): void {
  if (a.kind === "outreach_batch" || a.kind === "outreach_message") {
    const ids = (JSON.parse(a.payload) as { outreach_ids?: string[] }).outreach_ids ?? [];
    for (const oid of ids) {
      update("outreach", oid, { status: "approved", approval_id: a.id });
    }
  }
}
