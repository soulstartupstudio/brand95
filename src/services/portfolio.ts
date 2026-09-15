import { all, get, insert, update, newId, now, logEvent, actor } from "../db/index.ts";
import { blueprint, firstStage } from "../domain/blueprints.ts";
import type { Company, Unit, GateEvidence, Metric } from "../domain/types.ts";

export function listCompanies(): Company[] {
  return all<Company>("SELECT * FROM companies ORDER BY sort, name");
}

export function getCompany(ref: string): Company | undefined {
  return get<Company>("SELECT * FROM companies WHERE id = ? OR slug = ?", ref, ref);
}

export function createCompany(input: { slug: string; name: string; kind: Company["kind"]; north_star?: string; sort?: number }): Company {
  const existing = getCompany(input.slug);
  if (existing) return existing;
  const row = { id: newId(), slug: input.slug, name: input.name, kind: input.kind, north_star: input.north_star ?? null, status: "active", sort: input.sort ?? 0, created_at: now() };
  insert("companies", row);
  logEvent(actor(), "company.created", { ref_id: row.id, payload: { slug: row.slug } });
  return row as Company;
}

export function listUnits(companyRef?: string): Unit[] {
  if (companyRef) {
    const c = getCompany(companyRef);
    if (!c) return [];
    return all<Unit>("SELECT * FROM units WHERE company_id = ? ORDER BY sort, name", c.id);
  }
  return all<Unit>("SELECT * FROM units ORDER BY company_id, sort, name");
}

/** Resolve a unit by id, slug, or company/slug. */
export function getUnit(ref: string): Unit | undefined {
  if (ref.includes("/")) {
    const [c, s] = ref.split("/");
    const company = getCompany(c);
    if (!company) return undefined;
    return get<Unit>("SELECT * FROM units WHERE company_id = ? AND slug = ?", company.id, s);
  }
  return get<Unit>("SELECT * FROM units WHERE id = ? OR slug = ?", ref, ref);
}

export function requireUnit(ref: string): Unit {
  const u = getUnit(ref);
  if (!u) throw new Error(`Unknown unit: ${ref}`);
  return u;
}

export function createUnit(input: {
  company: string; slug: string; name: string; kind: Unit["kind"]; blueprint: string; mission?: string; owner?: string; sort?: number; meta?: Record<string, unknown>;
}): Unit {
  const company = getCompany(input.company);
  if (!company) throw new Error(`Unknown company: ${input.company}`);
  const existing = get<Unit>("SELECT * FROM units WHERE company_id = ? AND slug = ?", company.id, input.slug);
  if (existing) return existing;
  const bp = blueprint(input.blueprint);
  const stage = bp.kind === "validation" ? (firstStage(bp)?.key ?? null) : null;
  const row = {
    id: newId(), company_id: company.id, slug: input.slug, name: input.name, kind: input.kind, blueprint: bp.key, stage,
    owner: input.owner ?? "founder", status: "active", mission: input.mission ?? bp.mission, meta: JSON.stringify(input.meta ?? {}),
    sort: input.sort ?? 0, created_at: now(),
  };
  insert("units", row);
  logEvent(actor(), "unit.created", { unit_id: row.id, ref_id: row.id, payload: { slug: row.slug, blueprint: bp.key } });
  return row as unknown as Unit;
}

export function setUnitStatus(ref: string, status: Unit["status"], reason?: string): Unit {
  const u = requireUnit(ref);
  update("units", u.id, { status });
  logEvent(actor(), "unit.status", { unit_id: u.id, ref_id: u.id, payload: { status, reason } });
  return requireUnit(u.id);
}

// --- gates ----------------------------------------------------------------

export function gateEvidence(unitId: string, stage?: string | null): GateEvidence[] {
  if (stage) return all<GateEvidence>("SELECT * FROM gate_evidence WHERE unit_id = ? AND stage = ?", unitId, stage);
  return all<GateEvidence>("SELECT * FROM gate_evidence WHERE unit_id = ?", unitId);
}

export function markCriterion(unitRef: string, criterion: string, status: GateEvidence["status"], evidence?: string, stage?: string): GateEvidence {
  const u = requireUnit(unitRef);
  const bp = blueprint(u.blueprint);
  const st = stage ?? u.stage;
  if (!st) throw new Error(`Unit ${u.slug} has no stage (blueprint ${bp.key} is not a validation blueprint)`);
  const stageDef = bp.stages?.find((s) => s.key === st);
  if (!stageDef) throw new Error(`Unknown stage ${st} for ${bp.key}`);
  if (!stageDef.criteria.some((c) => c.key === criterion)) {
    throw new Error(`Unknown criterion ${criterion} for stage ${st}. Known: ${stageDef.criteria.map((c) => c.key).join(", ")}`);
  }
  const existing = get<GateEvidence>("SELECT * FROM gate_evidence WHERE unit_id = ? AND stage = ? AND criterion = ?", u.id, st, criterion);
  if (existing) {
    update("gate_evidence", existing.id, { status, evidence: evidence ?? existing.evidence, updated_at: now() });
  } else {
    insert("gate_evidence", { id: newId(), unit_id: u.id, stage: st, criterion, status, evidence: evidence ?? null, updated_at: now() });
  }
  logEvent(actor(), "gate.criterion", { unit_id: u.id, payload: { stage: st, criterion, status } });
  return get<GateEvidence>("SELECT * FROM gate_evidence WHERE unit_id = ? AND stage = ? AND criterion = ?", u.id, st, criterion)!;
}

export interface GateStatus {
  stage: string; name: string; total: number; met: number; open: { key: string; label: string; target?: number }[]; complete: boolean;
}

export function gateStatus(u: Unit): GateStatus | null {
  const bp = blueprint(u.blueprint);
  const st = bp.stages?.find((s) => s.key === u.stage);
  if (!st) return null;
  const ev = gateEvidence(u.id, st.key);
  const metKeys = new Set(ev.filter((e) => e.status !== "open").map((e) => e.criterion));
  const open = st.criteria.filter((c) => !metKeys.has(c.key));
  return { stage: st.key, name: st.name, total: st.criteria.length, met: st.criteria.length - open.length, open, complete: open.length === 0 };
}

/** Advance a unit to the next stage. Requires gate complete unless force. */
export function advanceStage(unitRef: string, opts: { force?: boolean; note?: string } = {}): Unit {
  const u = requireUnit(unitRef);
  const bp = blueprint(u.blueprint);
  if (!bp.stages) throw new Error(`${u.slug} is a department; it has no stages`);
  const gs = gateStatus(u);
  if (gs && !gs.complete && !opts.force) {
    throw new Error(`Gate for ${gs.name} not complete: ${gs.open.map((o) => o.key).join(", ")} still open. Use --force to override (logged).`);
  }
  const i = bp.stages.findIndex((s) => s.key === u.stage);
  const next = bp.stages[i + 1];
  if (!next) throw new Error(`${u.slug} is already at the final stage`);
  update("units", u.id, { stage: next.key });
  logEvent(actor(), "unit.stage_advanced", { unit_id: u.id, ref_id: u.id, payload: { from: u.stage, to: next.key, forced: !!opts.force, note: opts.note } });
  return requireUnit(u.id);
}

// --- metrics ---------------------------------------------------------------

export function recordMetric(unitRef: string, key: string, value: number, period: string, note?: string): Metric {
  const u = requireUnit(unitRef);
  const existing = get<Metric>("SELECT * FROM metrics WHERE unit_id = ? AND key = ? AND period = ?", u.id, key, period);
  if (existing) update("metrics", existing.id, { value, note: note ?? existing.note, recorded_at: now() });
  else insert("metrics", { id: newId(), unit_id: u.id, key, value, period, note: note ?? null, recorded_at: now() });
  logEvent(actor(), "metric.recorded", { unit_id: u.id, payload: { key, value, period } });
  return get<Metric>("SELECT * FROM metrics WHERE unit_id = ? AND key = ? AND period = ?", u.id, key, period)!;
}

export function latestMetrics(unitId: string): Metric[] {
  return all<Metric>(
    `SELECT m.* FROM metrics m
     JOIN (SELECT key, MAX(period) AS period FROM metrics WHERE unit_id = ? GROUP BY key) l
       ON l.key = m.key AND l.period = m.period
     WHERE m.unit_id = ? ORDER BY m.key`,
    unitId, unitId,
  );
}
