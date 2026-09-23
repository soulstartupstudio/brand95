import { all, get, insert, update, newId, now, logEvent, actor } from "../db/index.ts";
import { getCompany, requireUnit } from "./portfolio.ts";
import type { Goal } from "../domain/types.ts";

export interface GoalInput {
  company: string; key: string; label: string; target: number; deadline: string; start?: string;
  horizon?: "12m" | "36m"; unit?: string | null; metric_key?: string; baseline?: number; current?: number;
  unit_label?: string; direction?: "up" | "down"; note?: string;
}

export function upsertGoal(input: GoalInput): Goal {
  const c = getCompany(input.company);
  if (!c) throw new Error(`Unknown company: ${input.company}`);
  const unit_id = input.unit ? requireUnit(input.unit).id : null;
  const existing = get<Goal>("SELECT * FROM goals WHERE company_id = ? AND key = ?", c.id, input.key);
  const row = {
    company_id: c.id, unit_id, key: input.key, label: input.label, horizon: input.horizon ?? "12m", metric_key: input.metric_key ?? null,
    baseline: input.baseline ?? null, current: input.current ?? null, target: input.target, unit_label: input.unit_label ?? null,
    direction: input.direction ?? "up", start: input.start ?? now().slice(0, 10), deadline: input.deadline, status: "active", note: input.note ?? null, updated_at: now(),
  };
  if (existing) {
    // keep measured values unless explicitly given
    update("goals", existing.id, { ...row, baseline: input.baseline ?? existing.baseline, current: input.current ?? existing.current, status: existing.status });
    return get<Goal>("SELECT * FROM goals WHERE id = ?", existing.id)!;
  }
  const id = newId();
  insert("goals", { id, ...row });
  logEvent(actor(), "goal.created", { unit_id, ref_id: id, payload: { key: input.key, target: input.target } });
  return get<Goal>("SELECT * FROM goals WHERE id = ?", id)!;
}

export function setGoalProgress(ref: string, current: number, note?: string): Goal {
  const g = getGoal(ref);
  if (!g) throw new Error(`Unknown goal ${ref}`);
  const achieved = g.direction === "up" ? current >= g.target : current <= g.target;
  // First measurement becomes the baseline: progress is measured from where you started, not from zero.
  const baseline = g.baseline ?? current;
  update("goals", g.id, { current, baseline, note: note ?? g.note, updated_at: now(), status: achieved ? "achieved" : g.status === "achieved" ? "active" : g.status });
  logEvent(actor(), "goal.progress", { unit_id: g.unit_id, ref_id: g.id, payload: { key: g.key, current } });
  return getGoal(g.id)!;
}

export function getGoal(ref: string): Goal | undefined {
  const exact = get<Goal>("SELECT * FROM goals WHERE id = ?", ref);
  if (exact) return exact;
  if (ref.includes("/")) {
    const [c, k] = ref.split("/");
    const company = getCompany(c);
    return company ? get<Goal>("SELECT * FROM goals WHERE company_id = ? AND key = ?", company.id, k) : undefined;
  }
  const rows = all<Goal>("SELECT * FROM goals WHERE id LIKE ? OR key = ?", "%" + ref, ref);
  if (rows.length > 1) throw new Error(`Ambiguous goal ref ${ref}`);
  return rows[0];
}

export function listGoals(companyRef?: string): Goal[] {
  if (companyRef) {
    const c = getCompany(companyRef);
    return c ? all<Goal>("SELECT * FROM goals WHERE company_id = ? ORDER BY horizon, key", c.id) : [];
  }
  return all<Goal>("SELECT * FROM goals ORDER BY company_id, horizon, key");
}

export interface GoalTrack {
  goal: Goal;
  current: number | null;              // measured value (goal.current, or latest metric)
  progress: number | null;             // 0..1 of the distance baseline→target covered
  expected: number;                    // 0..1 of time elapsed start→deadline
  status: "no_data" | "ahead" | "on_track" | "behind" | "off_track" | "achieved" | "overdue";
  days_left: number;
  gap: number | null;                  // remaining distance to target in goal units
}

/** On-track math: linear expectation between start and deadline. Behind = >10 points under, off track = >25. */
export function trackGoal(goal: Goal, today = new Date()): GoalTrack {
  let g = goal;
  let current = g.current;
  if (g.metric_key && g.unit_id) {
    const m = get<{ value: number }>("SELECT value FROM metrics WHERE unit_id = ? AND key = ? ORDER BY period DESC LIMIT 1", g.unit_id, g.metric_key);
    if (m) {
      current = m.value;
      if (g.baseline === null) { update("goals", g.id, { baseline: m.value, current: m.value, updated_at: now() }); g = { ...g, baseline: m.value, current: m.value }; }
    }
  }
  const start = new Date(g.start).getTime();
  const end = new Date(g.deadline).getTime();
  const t = today.getTime();
  const expected = end <= start ? 1 : Math.min(1, Math.max(0, (t - start) / (end - start)));
  const days_left = Math.ceil((end - t) / 86400_000);
  if (g.status === "achieved") return { goal: g, current, progress: 1, expected, status: "achieved", days_left, gap: 0 };
  if (current === null || current === undefined) return { goal: g, current: null, progress: null, expected, status: "no_data", days_left, gap: null };
  const base = g.baseline ?? (g.direction === "up" ? 0 : current);
  const span = g.target - base;
  const progress = span === 0 ? 1 : Math.min(1, Math.max(0, (current - base) / span));
  const gap = g.direction === "up" ? Math.max(0, g.target - current) : Math.max(0, current - g.target);
  let status: GoalTrack["status"];
  if (progress >= 1) status = "achieved";
  else if (days_left < 0) status = "overdue";
  else {
    const delta = progress - expected;
    status = delta >= 0.05 ? "ahead" : delta >= -0.1 ? "on_track" : delta >= -0.25 ? "behind" : "off_track";
  }
  return { goal: g, current, progress, expected, status, days_left, gap };
}

export function trackAll(companyRef?: string): GoalTrack[] {
  return listGoals(companyRef).filter((g) => g.status !== "dropped").map((g) => trackGoal(g));
}
