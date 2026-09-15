import { all, get, insert, update, newId, now, logEvent, actor, byRef } from "../db/index.ts";
import { requireUnit } from "./portfolio.ts";
import type { Task, Initiative, Decision, Note, Experiment, AgentRun } from "../domain/types.ts";

// --- tasks ---------------------------------------------------------------

export function addTask(unitRef: string, title: string, opts: Partial<Pick<Task, "notes" | "priority" | "owner" | "due" | "initiative_id" | "status">> = {}): Task {
  const u = requireUnit(unitRef);
  const row = {
    id: newId(), unit_id: u.id, initiative_id: opts.initiative_id ?? null, title, notes: opts.notes ?? null,
    status: opts.status ?? "open", priority: opts.priority ?? 2, owner: opts.owner ?? "founder", due: opts.due ?? null, created_at: now(), done_at: null,
  };
  insert("tasks", row);
  logEvent(actor(), "task.created", { unit_id: u.id, ref_id: row.id, payload: { title } });
  return row as Task;
}

export function listTasks(unitRef?: string, status?: string): Task[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (unitRef) { clauses.push("unit_id = ?"); params.push(requireUnit(unitRef).id); }
  if (status) { clauses.push("status = ?"); params.push(status); }
  else clauses.push("status NOT IN ('done','dropped')");
  return all<Task>(`SELECT * FROM tasks ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY priority, COALESCE(due,'9999'), created_at`, ...params);
}

export function setTaskStatus(id: string, status: Task["status"], note?: string): Task {
  const t = byRef<Task>("tasks", id);
  if (!t) throw new Error(`Unknown task ${id}`);
  update("tasks", t.id, { status, done_at: status === "done" ? now() : null, notes: note ? [t.notes, note].filter(Boolean).join("\n") : t.notes });
  logEvent(actor(), "task.status", { unit_id: t.unit_id, ref_id: t.id, payload: { status } });
  return get<Task>("SELECT * FROM tasks WHERE id = ?", t.id)!;
}

export function overdueTasks(unitId?: string): Task[] {
  const today = now().slice(0, 10);
  return unitId
    ? all<Task>("SELECT * FROM tasks WHERE unit_id = ? AND status NOT IN ('done','dropped') AND due IS NOT NULL AND due < ?", unitId, today)
    : all<Task>("SELECT * FROM tasks WHERE status NOT IN ('done','dropped') AND due IS NOT NULL AND due < ?", today);
}

// --- initiatives ---------------------------------------------------------

export function addInitiative(unitRef: string, title: string, opts: Partial<Pick<Initiative, "objective" | "priority" | "owner" | "due">> = {}): Initiative {
  const u = requireUnit(unitRef);
  const row = { id: newId(), unit_id: u.id, title, objective: opts.objective ?? null, status: "active", priority: opts.priority ?? 2, owner: opts.owner ?? "founder", due: opts.due ?? null, created_at: now(), done_at: null };
  insert("initiatives", row);
  logEvent(actor(), "initiative.created", { unit_id: u.id, ref_id: row.id, payload: { title } });
  return row as Initiative;
}

export function listInitiatives(unitRef?: string): Initiative[] {
  return unitRef
    ? all<Initiative>("SELECT * FROM initiatives WHERE unit_id = ? AND status = 'active' ORDER BY priority, created_at", requireUnit(unitRef).id)
    : all<Initiative>("SELECT * FROM initiatives WHERE status = 'active' ORDER BY priority, created_at");
}

export function closeInitiative(id: string, status: "done" | "dropped" = "done"): void {
  const i = byRef<Initiative>("initiatives", id);
  if (!i) throw new Error(`Unknown initiative ${id}`);
  update("initiatives", i.id, { status, done_at: now() });
  logEvent(actor(), "initiative.closed", { unit_id: i.unit_id, ref_id: i.id, payload: { status } });
}

// --- decisions -----------------------------------------------------------

export function addDecision(unitRef: string | null, title: string, opts: { context?: string; options?: string[] } = {}): Decision {
  const unit_id = unitRef ? requireUnit(unitRef).id : null;
  const row = { id: newId(), unit_id, title, context: opts.context ?? null, options: JSON.stringify(opts.options ?? []), decision: null, rationale: null, status: "open", created_at: now(), decided_at: null };
  insert("decisions", row);
  logEvent(actor(), "decision.opened", { unit_id, ref_id: row.id, payload: { title } });
  return row as Decision;
}

export function decide(id: string, decision: string, rationale?: string): Decision {
  const d = byRef<Decision>("decisions", id);
  if (!d) throw new Error(`Unknown decision ${id}`);
  update("decisions", d.id, { decision, rationale: rationale ?? null, status: "decided", decided_at: now() });
  logEvent(actor(), "decision.made", { unit_id: d.unit_id, ref_id: d.id, payload: { decision } });
  return get<Decision>("SELECT * FROM decisions WHERE id = ?", d.id)!;
}

export function listDecisions(unitRef?: string, status?: string): Decision[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (unitRef) { clauses.push("unit_id = ?"); params.push(requireUnit(unitRef).id); }
  if (status) { clauses.push("status = ?"); params.push(status); }
  return all<Decision>(`SELECT * FROM decisions ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY created_at DESC`, ...params);
}

// --- notes / research / feedback ------------------------------------------

export function addNote(unitRef: string | null, title: string, body: string, kind: Note["kind"] = "note", author = actor()): Note {
  const unit_id = unitRef ? requireUnit(unitRef).id : null;
  const row = { id: newId(), unit_id, kind, title, body, author, created_at: now() };
  insert("notes", row);
  logEvent(author, "note.created", { unit_id, ref_id: row.id, payload: { kind, title } });
  return row as Note;
}

export function listNotes(unitRef?: string, kind?: string, limit = 50): Note[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (unitRef) { clauses.push("unit_id = ?"); params.push(requireUnit(unitRef).id); }
  if (kind) { clauses.push("kind = ?"); params.push(kind); }
  params.push(limit);
  return all<Note>(`SELECT * FROM notes ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`, ...params);
}

export function getNote(id: string): Note | undefined {
  return byRef<Note>("notes", id);
}

// --- experiments -----------------------------------------------------------

export function addExperiment(unitRef: string, hypothesis: string, opts: Partial<Pick<Experiment, "method" | "metric" | "target" | "stage">> = {}): Experiment {
  const u = requireUnit(unitRef);
  const row = { id: newId(), unit_id: u.id, stage: opts.stage ?? u.stage, hypothesis, method: opts.method ?? null, metric: opts.metric ?? null, target: opts.target ?? null, result: null, learning: null, status: "planned", created_at: now(), started_at: null, ended_at: null };
  insert("experiments", row);
  logEvent(actor(), "experiment.created", { unit_id: u.id, ref_id: row.id, payload: { hypothesis } });
  return row as Experiment;
}

export function setExperiment(id: string, patch: Partial<Pick<Experiment, "status" | "result" | "learning">>): Experiment {
  const e = byRef<Experiment>("experiments", id);
  if (!e) throw new Error(`Unknown experiment ${id}`);
  const extra: Record<string, unknown> = {};
  if (patch.status === "running" && !e.started_at) extra.started_at = now();
  if (patch.status && ["passed", "failed", "inconclusive"].includes(patch.status)) extra.ended_at = now();
  update("experiments", e.id, { ...patch, ...extra });
  logEvent(actor(), "experiment.updated", { unit_id: e.unit_id, ref_id: e.id, payload: patch });
  return get<Experiment>("SELECT * FROM experiments WHERE id = ?", e.id)!;
}

export function listExperiments(unitRef?: string): Experiment[] {
  return unitRef
    ? all<Experiment>("SELECT * FROM experiments WHERE unit_id = ? ORDER BY created_at DESC", requireUnit(unitRef).id)
    : all<Experiment>("SELECT * FROM experiments ORDER BY created_at DESC");
}

// --- agent runs -----------------------------------------------------------

export function startAgentRun(agent: string, unitRef: string | null, objective: string): AgentRun {
  const unit_id = unitRef ? requireUnit(unitRef).id : null;
  const row = { id: newId(), agent, unit_id, objective, status: "running", summary: null, outputs: "[]", started_at: now(), finished_at: null };
  insert("agent_runs", row);
  logEvent(`agent:${agent}`, "agent.started", { unit_id, ref_id: row.id, payload: { objective } });
  return row as AgentRun;
}

export function finishAgentRun(id: string, status: "completed" | "failed", summary: string, outputs: unknown[] = []): AgentRun {
  const r = byRef<AgentRun>("agent_runs", id);
  if (!r) throw new Error(`Unknown agent run ${id}`);
  update("agent_runs", r.id, { status, summary, outputs: JSON.stringify(outputs), finished_at: now() });
  logEvent(`agent:${r.agent}`, "agent.finished", { unit_id: r.unit_id, ref_id: r.id, payload: { status } });
  return get<AgentRun>("SELECT * FROM agent_runs WHERE id = ?", r.id)!;
}

export function listAgentRuns(limit = 20): AgentRun[] {
  return all<AgentRun>("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?", limit);
}
