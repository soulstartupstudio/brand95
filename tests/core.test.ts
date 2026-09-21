import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb, closeDb } from "../src/db/index.ts";
import { seed } from "../src/seed.ts";
import * as P from "../src/services/portfolio.ts";
import * as W from "../src/services/work.ts";
import * as A from "../src/services/approvals.ts";
import * as L from "../src/services/pipeline.ts";
import { nextForUnit, nextForPortfolio } from "../src/engine/next.ts";
import { founderBrief } from "../src/engine/brief.ts";

before(() => { openDb(":memory:"); seed(); });
after(() => closeDb());

test("seed is idempotent", () => {
  const r = seed();
  assert.equal(r.companies, 0);
  assert.equal(r.units, 0);
  assert.equal(P.listCompanies().length, 5);
});

test("validation units start at the first stage and gates block advancing", () => {
  const u = P.requireUnit("brand95/camera95");
  assert.equal(u.stage, "intake");
  assert.throws(() => P.advanceStage(u.id), /not complete/);
  P.markCriterion(u.id, "form", "met", "intake doc v1");
  P.markCriterion(u.id, "spend", "met", "approved 2 days research");
  const gs = P.gateStatus(P.requireUnit(u.id))!;
  assert.equal(gs.complete, true);
  const adv = P.advanceStage(u.id);
  assert.equal(adv.stage, "discover");
  assert.throws(() => P.markCriterion(u.id, "nope", "met"), /Unknown criterion/);
});

test("departments have no stages", () => {
  assert.throws(() => P.advanceStage("custom95/sales"), /no stages/);
});

test("outreach: draft → batch approval → approved → sent; unapproved cannot be sent", () => {
  const sales = P.requireUnit("custom95/sales");
  const lead = L.addLead(sales.id, { company_name: "Acme Test BV", contact_email: "x@example.invalid", fit_score: 70, status: "researched" });
  const d = L.draftOutreach(lead.id, { subject: "Hi", body: "Body" });
  assert.equal(d.status, "draft");
  assert.equal(L.getLead(lead.id)!.status, "queued");
  assert.throws(() => L.markSent(d.id), /only approved/);
  const a = L.requestOutreachBatchApproval(sales.id);
  assert.equal(a.kind, "outreach_batch");
  assert.equal(a.status, "pending");
  assert.throws(() => L.markSent(d.id), /only approved/);
  A.decideApproval(a.id, "approved", "ok");
  assert.equal(L.getOutreach(d.id)!.status, "approved");
  const sent = L.markSent(d.id, "gmail-123");
  assert.equal(sent.status, "sent");
  assert.equal(L.getLead(lead.id)!.status, "contacted");
  assert.equal(A.getApproval(a.id)!.status, "executed");
  assert.throws(() => A.decideApproval(a.id, "rejected"), /already/);
});

test("rejected batch leaves drafts unsent", () => {
  const sales = P.requireUnit("student95/sales");
  const lead = L.addLead(sales.id, { company_name: "Student Assoc X", contact_email: "y@example.invalid" });
  const d = L.draftOutreach(lead.id, { subject: "Hi", body: "Body" });
  const a = L.requestOutreachBatchApproval(sales.id);
  A.decideApproval(a.id, "rejected", "wrong angle");
  assert.equal(L.getOutreach(d.id)!.status, "draft");
  assert.throws(() => L.markSent(d.id), /only approved/);
});

test("short id refs resolve by suffix", () => {
  const t = W.addTask("custom95/finance", "Suffix task");
  const done = W.setTaskStatus(t.id.slice(-6), "done");
  assert.equal(done.status, "done");
});

test("next-step engine surfaces pending approvals first", () => {
  const u = P.requireUnit("brand95/hold");
  const a = A.requestApproval({ unit: u.id, kind: "next_step", title: "Approve X", proposal: "Do X", risk_level: 3 });
  const nx = nextForUnit(P.requireUnit(u.id));
  assert.equal(nx.actions[0].type, "decide");
  assert.match(nx.actions[0].title, /pending approval/);
  A.decideApproval(a.id, "rejected");
  const nx2 = nextForUnit(P.requireUnit(u.id));
  assert.notEqual(nx2.actions[0]?.type, "decide");
});

test("portfolio rule warns when two brands are in Build", () => {
  for (const slug of ["brand95/crossbody", "brand95/standard-dental"]) {
    const u = P.requireUnit(slug);
    for (const st of ["intake", "discover", "validate"]) {
      P.advanceStage(u.id, { force: true, note: "test" });
    }
  }
  const nx = nextForPortfolio("brand95");
  assert.ok(nx.warnings.some((w) => /in Build/.test(w)), nx.warnings.join("|"));
});

test("brief renders markdown with every company", () => {
  const md = founderBrief();
  for (const c of P.listCompanies()) assert.ok(md.includes(`## ${c.name}`));
  assert.ok(md.startsWith("# Founder brief"));
});

test("metrics upsert per period and KPI misses show up", () => {
  P.recordMetric("custom95/sales", "reply_rate", 3, "2026-09");
  P.recordMetric("custom95/sales", "reply_rate", 4, "2026-09");
  const m = P.latestMetrics(P.requireUnit("custom95/sales").id).find((x) => x.key === "reply_rate")!;
  assert.equal(m.value, 4);
  const nx = nextForUnit(P.requireUnit("custom95/sales"));
  assert.ok(nx.actions.some((a) => /KPIs off target/.test(a.title)));
});

// --- goals & cockpit ---------------------------------------------------------
import * as G from "../src/services/goals.ts";
import { cockpit } from "../src/engine/cockpit.ts";

test("goal tracking: no data, on track, behind, achieved", () => {
  const start = new Date(Date.now() - 100 * 86400_000).toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 100 * 86400_000).toISOString().slice(0, 10);
  const g = G.upsertGoal({ company: "custom95", key: "test_goal", label: "Test", target: 100, baseline: 0, start, deadline });
  assert.equal(G.trackGoal(g).status, "no_data");
  G.setGoalProgress("custom95/test_goal", 50);
  assert.equal(G.trackGoal(G.getGoal("custom95/test_goal")!).status, "on_track"); // expected ≈ 0.5
  G.setGoalProgress("custom95/test_goal", 20);
  assert.equal(G.trackGoal(G.getGoal("custom95/test_goal")!).status, "off_track");
  G.setGoalProgress("custom95/test_goal", 100);
  assert.equal(G.trackGoal(G.getGoal("custom95/test_goal")!).status, "achieved");
  assert.equal(G.getGoal("custom95/test_goal")!.status, "achieved");
});

test("goal linked to a metric reads the latest metric value", () => {
  const start = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);
  const deadline = new Date(Date.now() + 355 * 86400_000).toISOString().slice(0, 10);
  const g = G.upsertGoal({ company: "custom95", key: "margin_test", label: "Margin", target: 12, baseline: 0, start, deadline, unit: "custom95/finance", metric_key: "net_margin" });
  P.recordMetric("custom95/finance", "net_margin", 9, "2026-09");
  const t = G.trackGoal(G.getGoal(g.id)!);
  assert.equal(t.current, 9);
  assert.equal(t.status, "ahead");
});

test("cockpit computes levels, on-track score and drift", () => {
  const c = cockpit();
  assert.equal(c.companies.length, 5);
  const custom95 = c.companies.find((x) => x.slug === "custom95")!;
  assert.ok(custom95.level >= 0 && custom95.level <= 5);
  assert.ok(custom95.goals.length >= 2);
  assert.ok(typeof c.score === "number");
  assert.ok(c.drift.some((d) => /no current value/.test(d)));
});

test("seeded goals exist for every company", () => {
  for (const co of P.listCompanies()) assert.ok(G.listGoals(co.id).length >= 1, co.slug);
});
