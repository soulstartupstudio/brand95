import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb, closeDb, all } from "../src/db/index.ts";
import { seed } from "../src/seed.ts";
import { importSnapshot } from "../src/services/sync.ts";
import * as G from "../src/services/goals.ts";
import * as P from "../src/services/portfolio.ts";
import * as L from "../src/services/pipeline.ts";

before(() => { openDb(":memory:"); seed(); });
after(() => closeDb());

test("snapshot import writes metrics, goals, leads, notes, tasks; reports errors per item", () => {
  const r = importSnapshot({
    source: "moneybird+airtable", taken_at: "2026-09-21T10:00:00Z",
    metrics: [
      { unit: "custom95/finance", key: "net_margin", value: 2.3, note: "P&L this_year" },
      { unit: "custom95/finance", key: "revenue_mtd", value: 152835, period: "2026-08" },
      { unit: "nope/none", key: "x", value: 1 },
    ],
    goals: [{ goal: "custom95/revenue", current: 1617074 }, { goal: "custom95/unknown_goal", current: 1 }],
    leads: [{ unit: "custom95/sales", company_name: "Acme Sync BV", status: "proposal", fit_score: 70, source: "airtable" }],
    notes: [{ unit: "custom95/finance", title: "P&L note", body: "net_profit/total_revenue" }],
    tasks: [{ unit: "custom95/finance", title: "Chase 3 overdue invoices", priority: 1 }],
  });
  assert.equal(r.metrics, 2); assert.equal(r.goals, 1); assert.equal(r.leads_added, 1); assert.equal(r.notes, 1); assert.equal(r.tasks, 1);
  assert.equal(r.errors.length, 2);
  const fin = P.requireUnit("custom95/finance");
  assert.equal(P.latestMetrics(fin.id).find((m) => m.key === "net_margin")!.value, 2.3);
  const rev = G.trackGoal(G.getGoal("custom95/revenue")!);
  assert.equal(rev.current, 1617074);
  // margin goal is linked to the metric → tracked from it
  assert.equal(G.trackGoal(G.getGoal("custom95/net_margin")!).current, 2.3);
  // re-import dedupes the lead and upserts the metric
  const r2 = importSnapshot({ source: "airtable", leads: [{ unit: "custom95/sales", company_name: "acme sync bv", status: "won" }], metrics: [{ unit: "custom95/finance", key: "net_margin", value: 2.5, period: "2026-09" }] });
  assert.equal(r2.leads_added, 0); assert.equal(r2.leads_updated, 1);
  assert.equal(L.listLeads("custom95/sales").find((l) => l.company_name === "Acme Sync BV")!.status, "won");
  assert.equal(P.latestMetrics(fin.id).find((m) => m.key === "net_margin")!.value, 2.5);
  assert.ok(all("SELECT * FROM events WHERE type = 'sync.imported'").length >= 2);
});
