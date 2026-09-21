/** Cockpit: where each company is (level), whether it is on track to its goals, and where focus must go. */
import { listCompanies, listUnits, gateStatus, latestMetrics } from "../services/portfolio.ts";
import { listInitiatives } from "../services/work.ts";
import { listApprovals } from "../services/approvals.ts";
import { trackAll, type GoalTrack } from "../services/goals.ts";
import { blueprint } from "../domain/blueprints.ts";
import { nextForPortfolio, type Action } from "./next.ts";
import type { Unit } from "../domain/types.ts";

export interface UnitLevel { unit: Pick<Unit, "id" | "slug" | "name" | "kind" | "stage" | "status">; level: number; detail: string; score: number; }

export interface CompanyCockpit {
  slug: string; name: string; kind: string; north_star: string | null;
  level: number;                     // 0..5
  level_label: string;
  units: UnitLevel[];
  goals: GoalTrack[];
  on_track: { ok: number; measured: number; no_data: number };
  focus: (Action & { unit: string })[];
  alignment: { linked: number; total: number; unlinked: string[] };
  status: "on_track" | "attention" | "off_track" | "no_data";
}

export interface Cockpit {
  generated_at: string;
  score: number | null;              // % of measured goals on track or ahead, portfolio-wide
  approvals_pending: number;
  urgent: number;
  companies: CompanyCockpit[];
  drift: string[];                   // long-term alignment warnings
  warnings: string[];
}

const LEVELS = ["Idea", "Validating", "Building", "Operating", "Scaling", "Systemized"];

export function unitLevel(u: Unit, score: number): UnitLevel {
  const bp = blueprint(u.blueprint);
  const base = { unit: { id: u.id, slug: u.slug, name: u.name, kind: u.kind, stage: u.stage, status: u.status }, score };
  if (bp.kind === "validation" && bp.stages) {
    const i = Math.max(0, bp.stages.findIndex((s) => s.key === u.stage));
    const gs = gateStatus(u);
    const frac = (i + (gs && gs.total ? gs.met / gs.total : 0)) / bp.stages.length;
    return { ...base, level: Math.round(frac * 50) / 10, detail: gs ? `${gs.name} · gate ${gs.met}/${gs.total}` : u.stage ?? "" };
  }
  const kpis = bp.kpis ?? [];
  const metrics = latestMetrics(u.id);
  if (kpis.length === 0 || metrics.length === 0) return { ...base, level: 2, detail: "no KPIs recorded" };
  let onTarget = 0, withTarget = 0;
  for (const k of kpis) {
    const m = metrics.find((x) => x.key === k.key);
    if (!m || k.target === undefined) continue;
    withTarget++;
    if (k.direction === "up" ? m.value >= k.target : m.value <= k.target) onTarget++;
  }
  const coverage = metrics.length / kpis.length;
  const health = withTarget ? onTarget / withTarget : 0.5;
  const level = 2 + coverage * 1.5 + health * 1.5;
  return { ...base, level: Math.round(level * 10) / 10, detail: `${metrics.length}/${kpis.length} KPIs recorded · ${onTarget}/${withTarget} on target` };
}

export function cockpit(): Cockpit {
  const nx = nextForPortfolio();
  const approvals = listApprovals("pending").length;
  const goals = trackAll();
  const companies: CompanyCockpit[] = [];
  const drift: string[] = [];

  for (const c of listCompanies()) {
    const units = listUnits(c.id);
    const active = units.filter((u) => u.status === "active");
    const levels = active.map((u) => unitLevel(u, nx.units.find((x) => x.unit.id === u.id)?.score ?? 0));
    const level = levels.length ? Math.round((levels.reduce((s, l) => s + l.level, 0) / levels.length) * 10) / 10 : 0;
    const cg = goals.filter((g) => g.goal.company_id === c.id);
    const measured = cg.filter((g) => g.status !== "no_data");
    const ok = measured.filter((g) => ["ahead", "on_track", "achieved"].includes(g.status));
    const inits = active.flatMap((u) => listInitiatives(u.id));
    const linked = inits.filter((i) => i.goal_id).length;
    const focus = nx.units.filter((r) => r.company === c.slug).flatMap((r) => r.actions.filter((a) => a.priority === 1).map((a) => ({ ...a, unit: r.unit.name }))).slice(0, 3);
    let status: CompanyCockpit["status"] = "no_data";
    if (measured.length) {
      const bad = measured.filter((g) => ["off_track", "overdue"].includes(g.status)).length;
      status = bad ? "off_track" : ok.length === measured.length ? "on_track" : "attention";
    }
    if (cg.length === 0) drift.push(`${c.name} has no goals. A company without a target cannot be on or off track.`);
    if (active.length && inits.length && linked === 0) drift.push(`${c.name}: ${inits.length} initiative(s), none linked to a goal. Either link them or ask why they exist.`);
    for (const u of active) {
      if (u.kind !== "department" && u.status === "active" && !cg.some((g) => g.goal.unit_id === u.id) && !cg.some((g) => g.goal.horizon === "36m")) {
        drift.push(`${c.name}/${u.name} runs without any goal above it.`);
      }
    }
    companies.push({
      slug: c.slug, name: c.name, kind: c.kind, north_star: c.north_star, level, level_label: LEVELS[Math.min(5, Math.floor(level))],
      units: levels, goals: cg, on_track: { ok: ok.length, measured: measured.length, no_data: cg.length - measured.length },
      focus, alignment: { linked, total: inits.length, unlinked: inits.filter((i) => !i.goal_id).map((i) => i.title) }, status,
    });
  }

  const measuredAll = goals.filter((g) => g.status !== "no_data");
  const okAll = measuredAll.filter((g) => ["ahead", "on_track", "achieved"].includes(g.status));
  const score = measuredAll.length ? Math.round((100 * okAll.length) / measuredAll.length) : null;
  const noData = goals.filter((g) => g.status === "no_data").length;
  if (noData) drift.push(`${noData} goal(s) have no current value. Record them or the cockpit is flying blind.`);
  return { generated_at: new Date().toISOString(), score, approvals_pending: approvals, urgent: nx.top.length, companies, drift, warnings: nx.warnings };
}
