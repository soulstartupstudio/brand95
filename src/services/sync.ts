/**
 * Snapshot import: the bridge between connected apps (Moneybird, Airtable, Notion, Supabase, Shopify)
 * and the command center. Claude agents read the connectors and produce a snapshot JSON; this ingests it
 * idempotently, locally (`jarvis import file.json`) or over the API (`POST /api/import`, Bearer password).
 */
import { recordMetric, requireUnit } from "./portfolio.ts";
import { setGoalProgress, getGoal } from "./goals.ts";
import { addLead, getLead, updateLead, listLeads } from "./pipeline.ts";
import { addNote, addTask } from "./work.ts";
import { logEvent } from "../db/index.ts";

export interface Snapshot {
  source: string;                       // e.g. "moneybird+airtable" — who produced it
  taken_at?: string;                    // ISO timestamp
  metrics?: { unit: string; key: string; value: number; period?: string; note?: string }[];
  goals?: { goal: string; current: number; note?: string }[];
  leads?: { unit: string; company_name: string; status?: string; fit_score?: number; segment?: string; contact_name?: string; contact_email?: string; contact_role?: string; angle?: string; research?: string; website?: string; country?: string; source?: string }[];
  notes?: { unit?: string | null; title: string; body: string; kind?: "note" | "research" | "feedback" | "memo" }[];
  tasks?: { unit: string; title: string; priority?: number; due?: string; owner?: string }[];
}

export interface SyncResult { metrics: number; goals: number; leads_added: number; leads_updated: number; notes: number; tasks: number; errors: string[]; }

export function importSnapshot(s: Snapshot, actorName = `sync:${s.source}`): SyncResult {
  const r: SyncResult = { metrics: 0, goals: 0, leads_added: 0, leads_updated: 0, notes: 0, tasks: 0, errors: [] };
  const period = (s.taken_at ?? new Date().toISOString()).slice(0, 7);
  const note = (n?: string) => n ?? `${s.source} · ${(s.taken_at ?? new Date().toISOString()).slice(0, 10)}`;
  for (const m of s.metrics ?? []) {
    try { recordMetric(m.unit, m.key, m.value, m.period ?? period, note(m.note)); r.metrics++; } catch (e) { r.errors.push(`metric ${m.unit}/${m.key}: ${msg(e)}`); }
  }
  for (const g of s.goals ?? []) {
    try { if (!getGoal(g.goal)) throw new Error("unknown goal"); setGoalProgress(g.goal, g.current, note(g.note)); r.goals++; } catch (e) { r.errors.push(`goal ${g.goal}: ${msg(e)}`); }
  }
  for (const l of s.leads ?? []) {
    try {
      const unit = requireUnit(l.unit);
      const existing = listLeads(unit.id).find((x) => x.company_name.toLowerCase() === l.company_name.toLowerCase());
      if (existing) {
        const { unit: _u, company_name: _c, ...patch } = l;
        updateLead(existing.id, patch as never); r.leads_updated++;
      } else {
        const { unit: _u2, ...rest } = l;
        const created = addLead(unit.id, { ...(rest as Omit<typeof rest, "status"> & { status?: never }), status: l.status as never, source: l.source ?? s.source });
        if (getLead(created.id)) r.leads_added++;
      }
    } catch (e) { r.errors.push(`lead ${l.company_name}: ${msg(e)}`); }
  }
  for (const n of s.notes ?? []) {
    try { addNote(n.unit ?? null, n.title, n.body, n.kind ?? "note", actorName); r.notes++; } catch (e) { r.errors.push(`note ${n.title}: ${msg(e)}`); }
  }
  for (const t of s.tasks ?? []) {
    try { addTask(t.unit, t.title, { priority: t.priority, due: t.due, owner: t.owner }); r.tasks++; } catch (e) { r.errors.push(`task ${t.title}: ${msg(e)}`); }
  }
  logEvent(actorName, "sync.imported", { payload: { source: s.source, taken_at: s.taken_at, ...r } });
  return r;
}

function msg(e: unknown): string { return e instanceof Error ? e.message : String(e); }
