/**
 * Seed the real portfolio structure. Idempotent: re-running never duplicates.
 * `seed({ demo: true })` adds clearly-labelled sample data for trying the dashboard.
 */
import { get } from "./db/index.ts";
import * as P from "./services/portfolio.ts";
import * as W from "./services/work.ts";
import * as L from "./services/pipeline.ts";
import * as A from "./services/approvals.ts";
import { upsertGoal, listGoals } from "./services/goals.ts";

export function seed(opts: { demo?: boolean } = {}): { companies: number; units: number; tasks: number; leads: number } {
  const before = counts();

  P.createCompany({ slug: "custom95", name: "Custom95", kind: "agency", sort: 1,
    north_star: "€3M revenue at 12–15% margin, recurring via brandshops/portals/key accounts, runs without the founder. Exit-ready." });
  P.createCompany({ slug: "brand95", name: "Brand95", kind: "studio", sort: 2,
    north_star: "A repeatable brand-building engine: multiple €500k+ ARR brands, each run by a brand manager." });
  P.createCompany({ slug: "sss", name: "Soul Startup Studio", kind: "venture_builder", sort: 3,
    north_star: "Launch 1–2 purpose-driven, commercially viable startups with real traction. Fewer bets, higher conviction." });
  P.createCompany({ slug: "student95", name: "Student95", kind: "entity", sort: 4,
    north_star: "Own the student-association merch market as a separate brand, independent of Custom95 perception." });
  P.createCompany({ slug: "portapay", name: "PortaPay / Porta", kind: "saas", sort: 5,
    north_star: "Validate a lean invoice-and-payment layer between manufacturers and customers. No platform bloat." });

  // Custom95 departments
  P.createUnit({ company: "custom95", slug: "sales", name: "Sales", kind: "department", blueprint: "dept-sales", sort: 1,
    mission: "Land strategic FMCG, tech/fintech, travel/hospitality and agency accounts and convert them into recurring setups." });
  P.createUnit({ company: "custom95", slug: "operations", name: "Operations", kind: "department", blueprint: "dept-operations", sort: 2 });
  P.createUnit({ company: "custom95", slug: "finance", name: "Finance", kind: "department", blueprint: "dept-finance", sort: 3 });
  P.createUnit({ company: "custom95", slug: "marketing", name: "Marketing", kind: "department", blueprint: "dept-marketing", sort: 4,
    mission: "Make 'strategic merchandise partner, not a print shop' obvious to the right accounts." });
  P.createUnit({ company: "custom95", slug: "brandshops", name: "Brandshops & portals", kind: "concept", blueprint: "offer-validation", sort: 5,
    mission: "Turn one-off merch projects into recurring brandshop / portal / fulfilment setups with key accounts." });

  // Brand95 brands (from the Brand95 blueprint)
  P.createUnit({ company: "brand95", slug: "camera95", name: "Camera95", kind: "brand", blueprint: "brand-blueprint", sort: 1 });
  P.createUnit({ company: "brand95", slug: "crossbody", name: "Crossbody", kind: "brand", blueprint: "brand-blueprint", sort: 2 });
  P.createUnit({ company: "brand95", slug: "standard-dental", name: "Standard Dental", kind: "brand", blueprint: "brand-blueprint", sort: 3 });
  P.createUnit({ company: "brand95", slug: "hold", name: "Hold", kind: "brand", blueprint: "brand-blueprint", sort: 4 });

  // Student95
  P.createUnit({ company: "student95", slug: "sales", name: "Sales", kind: "department", blueprint: "dept-sales", sort: 1,
    mission: "Student associations, boards and lustrum committees: fast quotes, repeat orders every board year." });
  P.createUnit({ company: "student95", slug: "operations", name: "Operations", kind: "department", blueprint: "dept-operations", sort: 2 });

  // PortaPay as a venture under validation
  P.createUnit({ company: "portapay", slug: "validation", name: "PortaPay validation", kind: "venture", blueprint: "venture-validation", sort: 1,
    mission: "Prove manufacturers and their customers will pay to simplify invoices and payments before writing platform code." });

  // Starter tasks: only where the first step is unambiguous. Never duplicated.
  starterTask("custom95/sales", "Write the ICP and one outreach angle per segment (FMCG, tech/fintech, travel, agencies)", { priority: 1, owner: "founder" });
  starterTask("custom95/finance", "Record cash position and last-month margin per client as KPIs", { priority: 1 });
  starterTask("custom95/brandshops", "Name 10 existing accounts that could move to a brandshop/portal setup", { priority: 1 });
  starterTask("brand95/camera95", "Complete Stage 0 intake form", { priority: 2 });
  starterTask("brand95/crossbody", "Complete Stage 0 intake form", { priority: 3 });
  starterTask("brand95/standard-dental", "Complete Stage 0 intake form", { priority: 3 });
  starterTask("brand95/hold", "Complete Stage 0 intake form", { priority: 3 });
  starterTask("portapay/validation", "Write the one-page concept memo and set a validation time-box", { priority: 2 });

  seedGoals();
  if (opts.demo) demoData();

  const after = counts();
  return { companies: after.companies - before.companies, units: after.units - before.units, tasks: after.tasks - before.tasks, leads: after.leads - before.leads };
}

/** North-star goals as measurable targets. Current values stay empty until the founder records them. */
function seedGoals(): void {
  if (listGoals().length) return;
  const today = new Date();
  const plus = (months: number) => { const d = new Date(today); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
  const y12 = plus(12), y36 = plus(36);
  upsertGoal({ company: "custom95", key: "revenue", label: "Annual revenue", target: 3_000_000, unit_label: "EUR", horizon: "36m", deadline: y36, unit: "custom95/finance" });
  upsertGoal({ company: "custom95", key: "net_margin", label: "Net margin", target: 12, unit_label: "%", horizon: "12m", deadline: y12, unit: "custom95/finance", metric_key: "net_margin" });
  upsertGoal({ company: "custom95", key: "recurring_share", label: "Recurring revenue share (brandshops, portals, key accounts)", target: 40, unit_label: "%", horizon: "12m", deadline: y12, unit: "custom95/sales", metric_key: "recurring_revenue_share" });
  upsertGoal({ company: "custom95", key: "founder_hours", label: "Founder hours in operations per week", target: 2, unit_label: "h/week", direction: "down", horizon: "36m", deadline: y36, unit: "custom95/operations", metric_key: "founder_hours" });
  upsertGoal({ company: "brand95", key: "brands_500k", label: "Brands above €500k ARR with a brand manager", target: 2, unit_label: "brands", horizon: "36m", deadline: y36, baseline: 0 });
  upsertGoal({ company: "brand95", key: "first_launch", label: "First brand launched (100 paying customers)", target: 1, unit_label: "brand", horizon: "12m", deadline: y12, baseline: 0 });
  upsertGoal({ company: "sss", key: "ventures_traction", label: "Startups launched with real traction", target: 2, unit_label: "startups", horizon: "36m", deadline: y36, baseline: 0 });
  upsertGoal({ company: "sss", key: "ventures_validated", label: "Ideas validated to a fund / kill decision", target: 3, unit_label: "decisions", horizon: "12m", deadline: y12, baseline: 0 });
  upsertGoal({ company: "student95", key: "active_associations", label: "Active student associations ordering each board year", target: 25, unit_label: "associations", horizon: "12m", deadline: y12 });
  upsertGoal({ company: "portapay", key: "paying_pilots", label: "Paying pilots before any platform build", target: 5, unit_label: "pilots", horizon: "12m", deadline: y12, baseline: 0, unit: "portapay/validation" });
}

function starterTask(unit: string, title: string, opts: { priority?: number; owner?: string } = {}): void {
  const u = P.requireUnit(unit);
  const exists = get("SELECT id FROM tasks WHERE unit_id = ? AND title = ?", u.id, title);
  if (!exists) W.addTask(u.id, title, opts);
}

function counts() {
  const n = (t: string) => Number((get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`) ?? { n: 0 }).n);
  return { companies: n("companies"), units: n("units"), tasks: n("tasks"), leads: n("leads") };
}

/** Fictional sample data, labelled DEMO, so the dashboard has something to show. */
function demoData(): void {
  const sales = P.requireUnit("custom95/sales");
  if (get("SELECT id FROM leads WHERE unit_id = ? AND source = 'demo'", sales.id)) return;
  const l1 = L.addLead(sales.id, { company_name: "DEMO Nordic Oat Co", segment: "fmcg", country: "NL", contact_name: "Demo Contact", contact_role: "Brand Manager", contact_email: "demo@example.invalid", fit_score: 82, status: "researched", source: "demo",
    angle: "Launching two SKUs in Q4; retail activation kits and a sampling program are a natural fit.", research: "DEMO research note. Replace with real lead research." });
  const l2 = L.addLead(sales.id, { company_name: "DEMO Fintech Rails", segment: "tech", country: "DE", contact_name: "Demo Person", contact_role: "Head of People", contact_email: "demo2@example.invalid", fit_score: 74, status: "researched", source: "demo",
    angle: "Hiring 60 people in 6 months: onboarding kits and an internal brandshop.", research: "DEMO research note." });
  L.addLead(sales.id, { company_name: "DEMO Cityhop Hotels", segment: "travel", country: "BE", fit_score: 61, status: "new", source: "demo" });
  L.draftOutreach(l1.id, { subject: "Retail activation kits for the Q4 launch", body: "Hi Demo,\n\nSaw the Q4 launch announcement. We build strategic merch programs for FMCG launches (activation kits, sampling, retailer displays) and run them as a recurring setup.\n\nWorth a 20-minute call next week?\n\nDex", created_by: "agent:outreach-writer" });
  L.draftOutreach(l2.id, { subject: "Onboarding kits for 60 new hires", body: "Hi Demo,\n\nCongrats on the growth. We run internal brandshops for tech teams so onboarding merch ships itself.\n\nOpen to a short call?\n\nDex", created_by: "agent:outreach-writer" });
  L.requestOutreachBatchApproval(sales.id, { recommendation: "DEMO batch. Approve to see the flow; nothing is actually sent." });
  P.recordMetric(sales.id, "outreach_sent", 12, new Date().toISOString().slice(0, 7), "demo");
  P.recordMetric(sales.id, "reply_rate", 5, new Date().toISOString().slice(0, 7), "demo");
  const cam = P.requireUnit("brand95/camera95");
  W.addExperiment(cam.id, "DEMO: Gen-Z buyers will pre-order a €39 reusable film camera bundle", { method: "landing_page", metric: "qualified signups", target: "100 in 3 weeks" });
  A.requestApproval({ unit: cam.id, kind: "next_step", title: "DEMO: Approve research sprint for Camera95 (Stage 1 Discover)", proposal: "Run Research agent: 15 customer signals, 10 competitors, price architecture, unit economics low/base/high.", why_now: "Intake is complete; nothing else is in Discover.", exposure: "Founder review time only. Reversible.", alternatives: "Park Camera95; start with Crossbody instead.", recommendation: "Approve. Camera95 has the clearest dual-channel story.", risk_level: 3, requested_by: "agent:cofounder" });
  W.addDecision(cam.id, "DEMO: Retail-first, D2C-first, or dual validation for Camera95?", { options: ["retail-first", "d2c-first", "dual"], context: "See blueprint §14." });
}
