import { all, get, insert, update, newId, now, logEvent, actor, byRef } from "../db/index.ts";
import { requireUnit } from "./portfolio.ts";
import { requestApproval } from "./approvals.ts";
import type { Lead, Outreach, Approval } from "../domain/types.ts";

export type LeadInput = Partial<Omit<Lead, "id" | "unit_id" | "created_at" | "updated_at">> & { company_name: string };

export function addLead(unitRef: string, input: LeadInput): Lead {
  const u = requireUnit(unitRef);
  const dup = get<Lead>("SELECT * FROM leads WHERE unit_id = ? AND lower(company_name) = lower(?)", u.id, input.company_name);
  if (dup) return dup;
  const ts = now();
  const row: Lead = {
    id: newId(), unit_id: u.id, company_name: input.company_name, segment: input.segment ?? null, website: input.website ?? null,
    country: input.country ?? null, contact_name: input.contact_name ?? null, contact_role: input.contact_role ?? null,
    contact_email: input.contact_email ?? null, linkedin: input.linkedin ?? null, fit_score: input.fit_score ?? null,
    status: input.status ?? "new", research: input.research ?? null, angle: input.angle ?? null, source: input.source ?? null,
    next_action_at: input.next_action_at ?? null, created_at: ts, updated_at: ts,
  };
  insert("leads", row as unknown as Record<string, unknown>);
  logEvent(actor(), "lead.created", { unit_id: u.id, ref_id: row.id, payload: { company: row.company_name } });
  return row;
}

export function getLead(id: string): Lead | undefined {
  return byRef<Lead>("leads", id);
}

export function updateLead(id: string, patch: Partial<Lead>): Lead {
  const l = getLead(id);
  if (!l) throw new Error(`Unknown lead ${id}`);
  const { id: _i, unit_id: _u, created_at: _c, ...rest } = patch;
  update("leads", l.id, { ...rest, updated_at: now() });
  logEvent(actor(), "lead.updated", { unit_id: l.unit_id, ref_id: l.id, payload: Object.keys(rest) });
  return getLead(l.id)!;
}

export function listLeads(unitRef?: string, status?: string): Lead[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (unitRef) { clauses.push("unit_id = ?"); params.push(requireUnit(unitRef).id); }
  if (status) { clauses.push("status = ?"); params.push(status); }
  return all<Lead>(`SELECT * FROM leads ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY COALESCE(fit_score,0) DESC, updated_at DESC`, ...params);
}

export function pipelineSummary(unitId: string): Record<string, number> {
  const rows = all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM leads WHERE unit_id = ? GROUP BY status", unitId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

/** Leads in 'contacted' with no touch for > days. */
export function staleLeads(unitId: string, days = 7): Lead[] {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  return all<Lead>("SELECT * FROM leads WHERE unit_id = ? AND status = 'contacted' AND updated_at < ?", unitId, cutoff);
}

// --- outreach --------------------------------------------------------------

export function draftOutreach(leadId: string, input: { subject?: string; body: string; channel?: string; to_email?: string; sequence_step?: number; created_by?: string }): Outreach {
  const l = getLead(leadId);
  if (!l) throw new Error(`Unknown lead ${leadId}`);
  const row: Outreach = {
    id: newId(), unit_id: l.unit_id, lead_id: l.id, approval_id: null, channel: input.channel ?? "email", sequence_step: input.sequence_step ?? 1,
    to_email: input.to_email ?? l.contact_email, subject: input.subject ?? null, body: input.body, status: "draft", external_id: null,
    created_by: input.created_by ?? actor(), created_at: now(), sent_at: null,
  };
  insert("outreach", row as unknown as Record<string, unknown>);
  if (l.status === "new" || l.status === "researched") updateLead(l.id, { status: "queued" });
  logEvent(row.created_by, "outreach.drafted", { unit_id: l.unit_id, ref_id: row.id, payload: { lead: l.company_name, step: row.sequence_step } });
  return row;
}

export function getOutreach(id: string): Outreach | undefined {
  return byRef<Outreach>("outreach", id);
}

export function listOutreach(unitRef?: string, status?: string): (Outreach & { company_name: string })[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (unitRef) { clauses.push("o.unit_id = ?"); params.push(requireUnit(unitRef).id); }
  if (status) { clauses.push("o.status = ?"); params.push(status); }
  return all(`SELECT o.*, l.company_name FROM outreach o JOIN leads l ON l.id = o.lead_id ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY o.created_at DESC`, ...params);
}

/** Bundle all draft outreach for a unit into one approval request (Level 1 batch approval). */
export function requestOutreachBatchApproval(unitRef: string, opts: { ids?: string[]; recommendation?: string } = {}): Approval {
  const u = requireUnit(unitRef);
  const drafts = opts.ids?.length
    ? opts.ids.map((id) => getOutreach(id)).filter((o): o is Outreach => !!o && o.status === "draft")
    : all<Outreach>("SELECT * FROM outreach WHERE unit_id = ? AND status = 'draft' AND approval_id IS NULL", u.id);
  if (drafts.length === 0) throw new Error("No draft outreach to approve");
  const leads = drafts.map((d) => getLead(d.lead_id)!);
  const lines = drafts.map((d, i) => `- ${leads[i].company_name} (${d.to_email ?? "no email"}): "${d.subject ?? "(no subject)"}"`);
  const a = requestApproval({
    unit: u.id,
    kind: "outreach_batch",
    title: `Send ${drafts.length} outreach email${drafts.length === 1 ? "" : "s"} for ${u.name}`,
    proposal: `Send the following ${drafts.length} drafted emails via Gmail:\n${lines.join("\n")}`,
    why_now: "Queue is researched and drafts are personalized; delay costs pipeline velocity.",
    evidence: "Each draft is based on a lead research note stored on the lead.",
    exposure: "External communication. Reversible only by follow-up. No spend.",
    alternatives: "Send a smaller batch; rewrite angle; skip low-fit leads.",
    recommendation: opts.recommendation ?? "Approve after spot-checking the two lowest fit scores.",
    risk_level: 1,
    payload: { outreach_ids: drafts.map((d) => d.id) },
  });
  for (const d of drafts) update("outreach", d.id, { approval_id: a.id });
  return a;
}

/** Record that an approved message went out (the actual send happens via the Gmail connector). */
export function markSent(outreachId: string, externalId?: string): Outreach {
  const o = getOutreach(outreachId);
  if (!o) throw new Error(`Unknown outreach ${outreachId}`);
  if (o.status !== "approved") throw new Error(`Outreach ${o.id} is ${o.status}; only approved messages can be marked sent`);
  update("outreach", o.id, { status: "sent", sent_at: now(), external_id: externalId ?? null });
  updateLead(o.lead_id, { status: "contacted", next_action_at: new Date(Date.now() + 4 * 86400_000).toISOString().slice(0, 10) });
  logEvent(actor(), "outreach.sent", { unit_id: o.unit_id, ref_id: o.id, payload: { external_id: externalId } });
  const remaining = o.approval_id ? all<Outreach>("SELECT id FROM outreach WHERE approval_id = ? AND status = 'approved'", o.approval_id) : [];
  if (o.approval_id && remaining.length === 0) {
    const a = get<Approval>("SELECT * FROM approvals WHERE id = ?", o.approval_id);
    if (a && a.status === "approved") update("approvals", a.id, { status: "executed", executed_at: now() });
  }
  return getOutreach(o.id)!;
}

export function markReplied(outreachId: string, note?: string): Outreach {
  const o = getOutreach(outreachId);
  if (!o) throw new Error(`Unknown outreach ${outreachId}`);
  update("outreach", o.id, { status: "replied" });
  updateLead(o.lead_id, { status: "replied", next_action_at: now().slice(0, 10) });
  logEvent(actor(), "outreach.replied", { unit_id: o.unit_id, ref_id: o.id, payload: { note } });
  return getOutreach(o.id)!;
}
