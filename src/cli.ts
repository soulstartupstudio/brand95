#!/usr/bin/env node
/**
 * jarvis — founder command center CLI.
 * Every command is a thin wrapper over src/services so the dashboard, tests and Claude agents share one core.
 */
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openDb, dbPath, all } from "./db/index.ts";
import { blueprints, blueprint } from "./domain/blueprints.ts";
import * as P from "./services/portfolio.ts";
import * as W from "./services/work.ts";
import * as A from "./services/approvals.ts";
import * as L from "./services/pipeline.ts";
import { nextForPortfolio, nextForUnit } from "./engine/next.ts";
import { founderBrief } from "./engine/brief.ts";
import { seed } from "./seed.ts";
import { serve } from "./server/index.ts";

const HELP = `
jarvis — founder command center

  Portfolio
    jarvis init                                   create the database
    jarvis seed [--demo]                          load the default portfolio (Custom95, Brand95, SSS, Student95, PortaPay)
    jarvis status [company]                       one-screen status of everything
    jarvis brief [company] [--out file.md]        founder brief (markdown)
    jarvis next [unit|company] [--json]           ranked next actions (the co-founder engine)
    jarvis companies | units [company]            list
    jarvis unit <company/slug>                    unit detail
    jarvis unit add <company> <slug> "Name" --kind department|venture|brand|concept --blueprint <key> [--mission ..]
    jarvis unit park|activate|kill <ref> [--reason ..]

  Approvals (the only door to anything external)
    jarvis approvals [--all]                      inbox
    jarvis approve <id> [--note ..]
    jarvis reject <id> [--note ..]
    jarvis changes <id> --note ..
    jarvis executed <id> [--note ..]              mark an approved step as carried out
    jarvis request <ref> --kind k --title t --proposal p [--why ..] [--evidence ..] [--exposure ..] [--alternatives ..] [--recommend ..] [--risk 0-3] [--payload json]

  Work
    jarvis tasks [ref] [--status s]
    jarvis task <ref> "title" [--due YYYY-MM-DD] [--p 1|2|3] [--owner x] [--notes ..]
    jarvis done <task-id> | jarvis task-status <id> <status>
    jarvis initiatives [ref] | jarvis initiative <ref> "title" [--objective ..] [--due ..]
    jarvis decisions [ref] | jarvis decision <ref|-> "title" [--context ..] [--options "a|b|c"]
    jarvis decide <id> "choice" [--why ..]
    jarvis note <ref|-> "title" --body ".." [--kind note|research|feedback|memo]
    jarvis notes [ref] [--kind k]

  Validation (ventures, brands, concepts)
    jarvis gate <ref> [criterion met|waived|open --evidence ..]   show or update gate criteria
    jarvis advance <ref> [--force]                move to next stage (gate must be complete)
    jarvis experiment <ref> "hypothesis" [--method m] [--metric m] [--target t]
    jarvis experiments [ref] | jarvis experiment-status <id> running|passed|failed|inconclusive [--result ..] [--learning ..]
    jarvis metric <ref> <key> <value> [--period 2026-09] [--note ..]

  Pipeline and outreach (B2B)
    jarvis leads [ref] [--status s]
    jarvis lead <ref> "Company" [--segment s] [--website w] [--country c] [--contact n] [--role r] [--email e] [--fit 0-100] [--angle ..] [--source ..]
    jarvis lead-update <id> [--status s] [--fit n] [--email e] [--angle ..] [--research ..] [--contact n] [--role r]
    jarvis draft <lead-id> --subject ".." --body ".." [--step n] [--channel email|linkedin]
    jarvis outreach [ref] [--status s]
    jarvis outreach batch <ref> [--ids a,b,c]     bundle drafts into one approval
    jarvis outreach sent <id> [--external-id x]  record that an approved email went out
    jarvis outreach replied <id>

  Agents
    jarvis agent start <name> <ref|-> "objective"
    jarvis agent finish <run-id> completed|failed "summary"
    jarvis agents

  System
    jarvis serve [--port 4795]                    dashboard + JSON API
    jarvis events [--limit 30]
    jarvis blueprints
    jarvis export [--out data/exports]            dump every table to JSON
`;

type Opts = Record<string, string | boolean | undefined>;

function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      json: { type: "boolean" }, all: { type: "boolean" }, force: { type: "boolean" }, demo: { type: "boolean" },
      out: { type: "string" }, port: { type: "string" }, status: { type: "string" }, note: { type: "string" },
      kind: { type: "string" }, title: { type: "string" }, proposal: { type: "string" }, why: { type: "string" },
      evidence: { type: "string" }, exposure: { type: "string" }, alternatives: { type: "string" }, recommend: { type: "string" },
      risk: { type: "string" }, payload: { type: "string" }, due: { type: "string" }, p: { type: "string" }, owner: { type: "string" },
      notes: { type: "string" }, objective: { type: "string" }, context: { type: "string" }, options: { type: "string" },
      body: { type: "string" }, method: { type: "string" }, metric: { type: "string" }, target: { type: "string" },
      result: { type: "string" }, learning: { type: "string" }, period: { type: "string" }, segment: { type: "string" },
      website: { type: "string" }, country: { type: "string" }, contact: { type: "string" }, role: { type: "string" },
      email: { type: "string" }, fit: { type: "string" }, angle: { type: "string" }, source: { type: "string" },
      research: { type: "string" }, subject: { type: "string" }, step: { type: "string" }, channel: { type: "string" },
      ids: { type: "string" }, "external-id": { type: "string" }, limit: { type: "string" }, reason: { type: "string" },
      blueprint: { type: "string" }, mission: { type: "string" },
    },
  });
  const o = values as Opts;
  const [cmd, ...args] = positionals;
  if (!cmd || cmd === "help" || cmd === "--help") { console.log(HELP.trim()); return; }

  if (cmd === "init") { openDb(); console.log(`Database ready at ${dbPath()}`); return; }
  openDb();
  const out = (v: unknown) => console.log(o.json || (v !== null && typeof v === "object") ? JSON.stringify(v, null, 2) : v);
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  const num = (k: string) => (str(k) !== undefined ? Number(str(k)) : undefined);

  switch (cmd) {
    case "seed": { const r = seed({ demo: !!o.demo }); console.log(`Seeded: ${r.companies} companies, ${r.units} units, ${r.tasks} tasks, ${r.leads} leads.`); return; }

    case "status": return printStatus(args[0], !!o.json);
    case "brief": {
      const md = founderBrief(args[0]);
      if (str("out")) { writeFileSync(str("out")!, md); console.log(`Brief written to ${str("out")}`); } else console.log(md);
      return;
    }
    case "next": {
      const ref = args[0];
      if (ref && P.getUnit(ref)) { const r = nextForUnit(P.requireUnit(ref)); return o.json ? out(r) : printUnitNext(r); }
      const r = nextForPortfolio(ref);
      if (o.json) return out(r);
      console.log(`NEXT · ${r.generated_at.slice(0, 16)}`);
      if (r.warnings.length) { console.log("\nWarnings"); for (const w of r.warnings) console.log(`  ! ${w}`); }
      console.log("\nDo today");
      if (!r.top.length) console.log("  (nothing urgent)");
      for (const a of r.top) console.log(`  1 [${a.company}/${a.unit}] ${a.title}\n      why: ${a.why}${a.command ? `\n      run: ${a.command}` : ""}`);
      console.log("\nBy unit");
      for (const u of r.units) { if (u.actions.length) { console.log(`  ${u.company}/${u.unit.slug} (score ${u.score})`); for (const a of u.actions.slice(0, 3)) console.log(`    ${a.priority} ${a.title}`); } }
      return;
    }
    case "companies": { const rows = P.listCompanies(); if (o.json) return out(rows); for (const c of rows) console.log(`${c.slug.padEnd(12)} ${c.kind.padEnd(16)} ${c.name}`); return; }
    case "units": {
      const rows = P.listUnits(args[0]);
      if (o.json) return out(rows);
      const cs = new Map(P.listCompanies().map((c) => [c.id, c.slug]));
      for (const u of rows) console.log(`${(cs.get(u.company_id) + "/" + u.slug).padEnd(28)} ${u.kind.padEnd(10)} ${(u.stage ?? "-").padEnd(10)} ${u.status.padEnd(9)} ${u.name}`);
      return;
    }
    case "unit": {
      if (args[0] === "add") {
        const u = P.createUnit({ company: args[1], slug: args[2], name: args[3] ?? args[2], kind: (str("kind") as never) ?? "concept", blueprint: str("blueprint") ?? "venture-validation", mission: str("mission"), owner: str("owner") });
        console.log(`Created ${u.name} (${u.kind}, ${u.blueprint}${u.stage ? `, stage ${u.stage}` : ""})`); return;
      }
      if (["park", "activate", "kill"].includes(args[0])) {
        const status = args[0] === "park" ? "parked" : args[0] === "kill" ? "killed" : "active";
        const u = P.setUnitStatus(args[1], status, str("reason"));
        console.log(`${u.name} → ${u.status}`); return;
      }
      const u = P.requireUnit(args[0]);
      const detail = unitDetail(u);
      if (o.json) return out(detail);
      console.log(`${u.name} [${u.kind}] · ${u.status} · blueprint ${u.blueprint}${u.stage ? ` · stage ${u.stage}` : ""}`);
      console.log(`mission: ${u.mission}`);
      if (detail.gate) console.log(`gate: ${detail.gate.met}/${detail.gate.total} ${detail.gate.complete ? "complete" : "open: " + detail.gate.open.map((x) => x.key).join(", ")}`);
      if (detail.metrics.length) console.log(`kpis: ${detail.metrics.map((m) => `${m.key}=${m.value}`).join(" · ")}`);
      console.log(`initiatives: ${detail.initiatives.map((i) => i.title).join("; ") || "none"}`);
      console.log(`open tasks: ${detail.tasks.length} · pending approvals: ${detail.approvals.length}`);
      if (detail.pipeline) console.log(`pipeline: ${JSON.stringify(detail.pipeline)}`);
      console.log("\nnext:"); for (const a of detail.next.actions) console.log(`  ${a.priority} ${a.title}`);
      return;
    }

    case "approvals": {
      const rows = A.listApprovals(o.all ? "all" : "pending", args[0]);
      if (o.json) return out(rows);
      if (!rows.length) return console.log("Inbox empty.");
      for (const a of rows) {
        console.log(`\n[${a.id.slice(-6)}] L${a.risk_level} ${a.kind} · ${a.status} · ${a.title}`);
        console.log(`  proposal: ${a.proposal.split("\n")[0]}`);
        if (a.why_now) console.log(`  why now:  ${a.why_now}`);
        if (a.exposure) console.log(`  exposure: ${a.exposure}`);
        if (a.recommendation) console.log(`  recommendation: ${a.recommendation}`);
      }
      return;
    }
    case "approve": return out(A.decideApproval(args[0], "approved", str("note")));
    case "reject": return out(A.decideApproval(args[0], "rejected", str("note")));
    case "changes": return out(A.decideApproval(args[0], "changes_requested", str("note")));
    case "executed": return out(A.markExecuted(args[0], str("note") ? { note: str("note") } : undefined));
    case "request": {
      const a = A.requestApproval({
        unit: args[0] === "-" ? null : args[0], kind: str("kind") ?? "other", title: str("title") ?? "Untitled", proposal: str("proposal") ?? "",
        why_now: str("why"), evidence: str("evidence"), exposure: str("exposure"), alternatives: str("alternatives"),
        recommendation: str("recommend"), risk_level: num("risk"), payload: str("payload") ? JSON.parse(str("payload")!) : undefined,
      });
      return out(o.json ? a : `Approval ${a.id} requested (L${a.risk_level}): ${a.title}`);
    }

    case "tasks": {
      const rows = W.listTasks(args[0], str("status"));
      if (o.json) return out(rows);
      for (const t of rows) console.log(`${t.id.slice(-6)} P${t.priority} ${t.status.padEnd(7)} ${(t.due ?? "").padEnd(10)} ${t.owner.padEnd(14)} ${t.title}`);
      return;
    }
    case "task": return out(W.addTask(args[0], args[1], { due: str("due"), priority: num("p"), owner: str("owner"), notes: str("notes") }));
    case "done": return out(W.setTaskStatus(args[0], "done", str("note")));
    case "task-status": return out(W.setTaskStatus(args[0], args[1] as never, str("note")));
    case "initiatives": return out(W.listInitiatives(args[0]));
    case "initiative": return out(W.addInitiative(args[0], args[1], { objective: str("objective"), due: str("due"), priority: num("p"), owner: str("owner") }));
    case "decisions": return out(W.listDecisions(args[0], str("status")));
    case "decision": return out(W.addDecision(args[0] === "-" ? null : args[0], args[1], { context: str("context"), options: str("options")?.split("|").map((s) => s.trim()) }));
    case "decide": return out(W.decide(args[0], args[1], str("why")));
    case "note": return out(W.addNote(args[0] === "-" ? null : args[0], args[1], str("body") ?? "", (str("kind") as never) ?? "note"));
    case "notes": {
      const rows = W.listNotes(args[0], str("kind"), num("limit") ?? 30);
      if (o.json) return out(rows);
      for (const n of rows) console.log(`${n.id.slice(-6)} ${n.created_at.slice(0, 10)} ${n.kind.padEnd(9)} ${n.author.padEnd(16)} ${n.title}`);
      return;
    }

    case "gate": {
      const u = P.requireUnit(args[0]);
      if (args[1]) return out(P.markCriterion(u.id, args[1], (args[2] as never) ?? "met", str("evidence")));
      const gs = P.gateStatus(u);
      if (!gs) return console.log(`${u.name} has no stages.`);
      const ev = P.gateEvidence(u.id, gs.stage);
      const bp = blueprint(u.blueprint);
      const st = bp.stages!.find((s) => s.key === gs.stage)!;
      if (o.json) return out({ ...gs, evidence: ev, purpose: st.purpose, outputs: st.outputs });
      console.log(`${u.name} · ${gs.name} · ${gs.met}/${gs.total}\n${st.purpose}\n`);
      for (const c of st.criteria) { const e = ev.find((x) => x.criterion === c.key); console.log(`  [${e && e.status !== "open" ? "x" : " "}] ${c.key.padEnd(12)} ${c.label}${e?.evidence ? `\n        evidence: ${e.evidence}` : ""}`); }
      console.log(`\nexpected outputs: ${st.outputs.join("; ")}`);
      return;
    }
    case "advance": { const u = P.advanceStage(args[0], { force: !!o.force, note: str("note") }); console.log(`${u.name} → stage ${u.stage}`); return; }
    case "experiment": return out(W.addExperiment(args[0], args[1], { method: str("method"), metric: str("metric"), target: str("target") }));
    case "experiments": return out(W.listExperiments(args[0]));
    case "experiment-status": return out(W.setExperiment(args[0], { status: args[1], result: str("result"), learning: str("learning") }));
    case "metric": return out(P.recordMetric(args[0], args[1], Number(args[2]), str("period") ?? new Date().toISOString().slice(0, 7), str("note")));

    case "leads": {
      const rows = L.listLeads(args[0], str("status"));
      if (o.json) return out(rows);
      for (const l of rows) console.log(`${l.id.slice(-6)} ${String(l.fit_score ?? "-").padStart(3)} ${l.status.padEnd(12)} ${(l.segment ?? "").padEnd(8)} ${l.company_name}${l.contact_name ? ` · ${l.contact_name}` : ""}${l.next_action_at ? ` · next ${l.next_action_at}` : ""}`);
      return;
    }
    case "lead": return out(L.addLead(args[0], { company_name: args[1], segment: str("segment"), website: str("website"), country: str("country"), contact_name: str("contact"), contact_role: str("role"), contact_email: str("email"), fit_score: num("fit"), angle: str("angle"), source: str("source"), research: str("research") }));
    case "lead-update": return out(L.updateLead(args[0], { status: str("status") as never, fit_score: num("fit"), contact_email: str("email"), angle: str("angle"), research: str("research"), contact_name: str("contact"), contact_role: str("role"), next_action_at: str("due") }));
    case "draft": return out(L.draftOutreach(args[0], { subject: str("subject"), body: str("body") ?? "", channel: str("channel"), sequence_step: num("step"), to_email: str("email") }));
    case "outreach": {
      if (args[0] === "batch") { const a = L.requestOutreachBatchApproval(args[1], { ids: str("ids")?.split(","), recommendation: str("recommend") }); return out(o.json ? a : `Approval ${a.id} requested: ${a.title}`); }
      if (args[0] === "sent") return out(L.markSent(args[1], str("external-id")));
      if (args[0] === "replied") return out(L.markReplied(args[1], str("note")));
      const rows = L.listOutreach(args[0], str("status"));
      if (o.json) return out(rows);
      for (const r of rows) console.log(`${r.id.slice(-6)} ${r.status.padEnd(9)} step${r.sequence_step} ${r.company_name.padEnd(24)} ${r.subject ?? ""}`);
      return;
    }

    case "agent": {
      if (args[0] === "start") return out(W.startAgentRun(args[1], args[2] === "-" ? null : args[2], args[3]));
      if (args[0] === "finish") return out(W.finishAgentRun(args[1], args[2] as never, args[3]));
      throw new Error("agent start|finish");
    }
    case "agents": return out(W.listAgentRuns(num("limit") ?? 20));

    case "serve": return void serve(num("port") ?? Number(process.env.JARVIS_PORT ?? 4795));
    case "events": {
      const rows = all("SELECT * FROM events ORDER BY ts DESC LIMIT ?", num("limit") ?? 30);
      if (o.json) return out(rows);
      for (const e of rows) console.log(`${String(e.ts).slice(0, 19)} ${String(e.actor).padEnd(16)} ${String(e.type).padEnd(22)} ${String(e.payload).slice(0, 80)}`);
      return;
    }
    case "blueprints": return out([...blueprints().values()].map((b) => o.json ? b : `${b.key.padEnd(20)} ${b.kind.padEnd(11)} ${b.name}`).join("\n"));
    case "export": {
      const dir = resolve(str("out") ?? "data/exports");
      mkdirSync(dir, { recursive: true });
      const tables = ["companies", "units", "gate_evidence", "initiatives", "tasks", "decisions", "approvals", "leads", "outreach", "experiments", "metrics", "agent_runs", "notes", "events"];
      for (const t of tables) writeFileSync(resolve(dir, `${t}.json`), JSON.stringify(all(`SELECT * FROM ${t}`), null, 2));
      console.log(`Exported ${tables.length} tables to ${dir}`);
      return;
    }
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP.trim());
      process.exitCode = 1;
  }
}

export function unitDetail(u: import("./domain/types.ts").Unit) {
  const bp = blueprint(u.blueprint);
  return {
    unit: u,
    blueprint: bp,
    gate: P.gateStatus(u),
    gate_evidence: P.gateEvidence(u.id),
    metrics: P.latestMetrics(u.id),
    initiatives: W.listInitiatives(u.id),
    tasks: W.listTasks(u.id),
    approvals: A.listApprovals("pending", u.id),
    decisions: W.listDecisions(u.id, "open"),
    experiments: W.listExperiments(u.id),
    pipeline: bp.key === "dept-sales" || u.kind !== "department" ? L.pipelineSummary(u.id) : null,
    leads: L.listLeads(u.id).slice(0, 100),
    outreach: L.listOutreach(u.id).slice(0, 50),
    notes: W.listNotes(u.id, undefined, 20),
    next: nextForUnit(u),
  };
}

function printUnitNext(r: ReturnType<typeof nextForUnit>): void {
  console.log(`${r.company}/${r.unit.slug} · score ${r.score}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
  for (const a of r.actions) console.log(`  ${a.priority} ${a.title}\n      why: ${a.why}${a.command ? `\n      run: ${a.command}` : ""}${a.agent ? `\n      agent: ${a.agent}` : ""}`);
}

function printStatus(scope: string | undefined, json: boolean): void {
  const companies = P.listCompanies().filter((c) => !scope || c.slug === scope);
  const nx = nextForPortfolio(scope);
  const approvals = A.listApprovals("pending");
  if (json) return void console.log(JSON.stringify({ companies: companies.map((c) => ({ ...c, units: P.listUnits(c.id).map((u) => ({ ...u, gate: P.gateStatus(u), open_tasks: W.listTasks(u.id).length })) })), approvals, next: nx }, null, 2));
  console.log(`JARVIS · ${new Date().toISOString().slice(0, 10)} · ${approvals.length} approval(s) pending · ${nx.top.length} urgent action(s)`);
  for (const w of nx.warnings) console.log(`  ! ${w}`);
  for (const c of companies) {
    console.log(`\n${c.name.toUpperCase()}  ${c.north_star ? "— " + c.north_star : ""}`);
    for (const u of P.listUnits(c.id)) {
      const gs = P.gateStatus(u);
      const un = nx.units.find((x) => x.unit.id === u.id);
      const tasks = W.listTasks(u.id).length;
      const stage = gs ? `${gs.name} ${gs.met}/${gs.total}` : "dept";
      console.log(`  ${u.name.padEnd(22)} ${u.status.padEnd(8)} ${stage.padEnd(26)} tasks ${String(tasks).padStart(2)}  ${un?.actions[0]?.title ?? ""}`);
    }
  }
}

main(process.argv.slice(2));
