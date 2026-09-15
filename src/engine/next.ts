/**
 * Next-step engine. Deterministic core of the "co-founder": looks at the state of a unit
 * and returns ranked actions. The Claude co-founder agent layers judgment on top of this.
 */
import { all } from "../db/index.ts";
import { blueprint, nextStage } from "../domain/blueprints.ts";
import { listUnits, gateStatus, latestMetrics, listCompanies } from "../services/portfolio.ts";
import { listTasks, overdueTasks, listInitiatives, listExperiments, listDecisions } from "../services/work.ts";
import { listApprovals } from "../services/approvals.ts";
import { pipelineSummary, staleLeads, listLeads } from "../services/pipeline.ts";
import type { Unit } from "../domain/types.ts";

export interface Action {
  priority: 1 | 2 | 3;               // 1 = do today
  type: "decide" | "unblock" | "evidence" | "advance" | "pipeline" | "focus" | "review" | "kill" | "system";
  title: string;
  why: string;
  command?: string;                  // jarvis CLI hint
  agent?: string;                    // suggested .claude agent
}

export interface UnitNext {
  unit: Pick<Unit, "id" | "slug" | "name" | "kind" | "stage" | "status" | "company_id">;
  company: string;
  score: number;                     // urgency 0-100
  actions: Action[];
  warnings: string[];
}

export function nextForUnit(u: Unit): UnitNext {
  const bp = blueprint(u.blueprint);
  const actions: Action[] = [];
  const warnings: string[] = [];
  const company = listCompanies().find((c) => c.id === u.company_id)?.slug ?? "?";
  const ref = `${company}/${u.slug}`;

  if (u.status !== "active") {
    return { unit: pick(u), company, score: 0, actions: [], warnings: [`${u.name} is ${u.status}`] };
  }

  // 1. Pending approvals block everything downstream.
  const pending = listApprovals("pending", u.id);
  if (pending.length) {
    actions.push({
      priority: 1, type: "decide",
      title: `Decide ${pending.length} pending approval${pending.length > 1 ? "s" : ""}: ${pending.map((p) => p.title).slice(0, 2).join("; ")}${pending.length > 2 ? "…" : ""}`,
      why: "Agents are waiting on you. Nothing external moves until you decide.",
      command: `jarvis approvals`,
    });
  }

  // 2. Open decisions.
  const openDecisions = listDecisions(u.id, "open");
  if (openDecisions.length) {
    actions.push({
      priority: 1, type: "decide",
      title: `Make ${openDecisions.length} open decision${openDecisions.length > 1 ? "s" : ""}: ${openDecisions[0].title}`,
      why: "Undecided questions stall execution and create parallel half-work.",
      command: `jarvis decide <id> "<choice>" --why "<rationale>"`,
    });
  }

  // 3. Overdue and blocked tasks.
  const overdue = overdueTasks(u.id);
  if (overdue.length) {
    actions.push({
      priority: 1, type: "unblock",
      title: `Clear ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}: ${overdue[0].title}`,
      why: "Overdue work is either urgent or should be dropped. Decide which.",
      command: `jarvis tasks ${ref}`,
    });
  }
  const blocked = listTasks(ref, "blocked");
  if (blocked.length) {
    actions.push({ priority: 2, type: "unblock", title: `Unblock ${blocked.length} task${blocked.length > 1 ? "s" : ""}: ${blocked[0].title}`, why: "Blocked tasks usually need a founder call or an external nudge.", command: `jarvis tasks ${ref} --status blocked` });
  }

  // 4. Validation units: gate logic.
  if (bp.kind === "validation") {
    const gs = gateStatus(u);
    const experiments = listExperiments(ref);
    const running = experiments.filter((e) => e.status === "running" && e.stage === u.stage);
    const stageExps = experiments.filter((e) => e.stage === u.stage);
    if (gs) {
      if (gs.complete) {
        const nx = nextStage(bp, u.stage);
        actions.push({
          priority: 1, type: "advance",
          title: nx ? `Gate ${gs.name} is complete → request stage-gate approval to enter ${nx.name}` : `Final stage complete → decide: systemized, graduate the unit`,
          why: "Evidence is in. Holding a validated unit at a passed gate is wasted time.",
          command: `jarvis advance ${ref}`,
        });
      } else {
        const isFirstStage = bp.stages?.[0]?.key === u.stage;
        if (isFirstStage) {
          actions.push({
            priority: 2, type: "evidence",
            title: `Complete ${gs.name} checklist: ${gs.open.map((o) => o.label).join(" · ")}`,
            why: "Stage 0 is a written commitment, not an experiment. Fill it or park the idea.",
            command: `jarvis gate ${ref} <criterion> met --evidence "<link or summary>"`,
            agent: "cofounder",
          });
        } else if (running.length === 0) {
          actions.push({
            priority: 1, type: "evidence",
            title: `No running experiment in ${gs.name}. Design one for: ${gs.open[0].label}`,
            why: `Gate has ${gs.open.length}/${gs.total} criteria open and nothing is generating evidence.`,
            command: `jarvis experiment ${ref} "<hypothesis>" --method <method> --metric "<metric>" --target "<target>"`,
            agent: u.kind === "brand" ? "research" : "concept-validator",
          });
        } else {
          actions.push({
            priority: 2, type: "evidence",
            title: `Collect evidence: ${gs.open.map((o) => o.label).slice(0, 2).join(" · ")}${gs.open.length > 2 ? ` (+${gs.open.length - 2})` : ""}`,
            why: `${running.length} experiment(s) running. Log results and mark criteria as they are met.`,
            command: `jarvis gate ${ref} <criterion> met --evidence "<what proves it>"`,
          });
        }
        const failed = stageExps.filter((e) => e.status === "failed").length;
        if (failed >= 2) {
          actions.push({ priority: 1, type: "kill", title: `Two failed experiments in ${gs.name}: park or pivot`, why: "Kill rule: no behavioral evidence after two cycles → park. Don't rationalize a third.", command: `jarvis unit park ${ref} --reason "<why>"` });
        }
      }
    }
  }

  // 5. Departments: health, KPIs, focus.
  if (bp.kind === "department") {
    const metrics = latestMetrics(u.id);
    const below = (bp.kpis ?? []).filter((k) => {
      if (k.target === undefined) return false;
      const m = metrics.find((x) => x.key === k.key);
      if (!m) return false;
      return k.direction === "up" ? m.value < k.target : m.value > k.target;
    });
    if (below.length) {
      actions.push({ priority: 2, type: "review", title: `KPIs off target: ${below.map((b) => b.label).join(", ")}`, why: "A department is only 'running' if its numbers are inside the band.", command: `jarvis unit ${ref}` });
    }
    if (metrics.length === 0) {
      actions.push({ priority: 3, type: "system", title: `No KPIs recorded yet for ${u.name}`, why: "You cannot delegate what you cannot measure.", command: `jarvis metric ${ref} <key> <value> --period ${new Date().toISOString().slice(0, 7)}` });
    }
    if (u.slug === "sales" || bp.key === "dept-sales") {
      const ps = pipelineSummary(u.id);
      const queued = (ps.researched ?? 0) + (ps.queued ?? 0);
      const stale = staleLeads(u.id);
      if (stale.length) {
        actions.push({ priority: 1, type: "pipeline", title: `Follow up ${stale.length} stale lead${stale.length > 1 ? "s" : ""} (contacted >7d, no follow-up)`, why: "Most replies come from the 2nd and 3rd touch. Silence is not a 'no'.", command: `jarvis leads ${ref} --status contacted`, agent: "outreach-writer" });
      }
      if (queued < 20) {
        actions.push({ priority: 2, type: "pipeline", title: `Refill the queue: ${queued}/20 researched leads ready for outreach`, why: "Outreach cadence dies when the queue is empty. Research is the leading indicator.", command: `jarvis leads ${ref} --status new`, agent: "lead-researcher" });
      }
      const drafts = all<{ n: number }>("SELECT COUNT(*) AS n FROM outreach WHERE unit_id = ? AND status = 'draft' AND approval_id IS NULL", u.id)[0]?.n ?? 0;
      if (Number(drafts) >= 5) {
        actions.push({ priority: 2, type: "pipeline", title: `${drafts} outreach drafts waiting: bundle into a batch approval`, why: "Drafts that don't ship are zero.", command: `jarvis outreach batch ${ref}` });
      }
      const approved = Number(all<{ n: number }>("SELECT COUNT(*) AS n FROM outreach WHERE unit_id = ? AND status = 'approved'", u.id)[0]?.n ?? 0);
      if (approved > 0) {
        actions.push({ priority: 1, type: "pipeline", title: `Send ${approved} approved email${approved > 1 ? "s" : ""} (Gmail) and mark them sent`, why: "Approved and unsent is the worst state: decided, but no effect.", command: `jarvis outreach ${ref} --status approved`, agent: "outreach-sender" });
      }
      const replied = listLeads(ref, "replied");
      if (replied.length) {
        actions.push({ priority: 1, type: "pipeline", title: `${replied.length} lead${replied.length > 1 ? "s" : ""} replied: respond and book meetings`, why: "Reply-to-response time is the strongest predictor of a meeting.", command: `jarvis leads ${ref} --status replied` });
      }
    }
  }

  // 6. Focus: no active initiative.
  const initiatives = listInitiatives(ref);
  if (initiatives.length === 0 && u.status === "active") {
    actions.push({ priority: 2, type: "focus", title: `No active initiative for ${u.name}. Define the one thing that moves it this month.`, why: "Units without an initiative drift into reactive work.", command: `jarvis initiative ${ref} "<title>" --objective "<measurable outcome>"` });
  }
  if (initiatives.length > 3) {
    warnings.push(`${initiatives.length} active initiatives in ${u.name}. Over-parallelization: cut to 3.`);
  }

  // 7. Nothing open at all.
  const openTasks = listTasks(ref);
  if (actions.length === 0 && openTasks.length === 0) {
    actions.push({ priority: 3, type: "focus", title: `${u.name} has nothing in flight. Either it is running by itself (good) or it is neglected (bad). Which?`, why: "Silence is ambiguous.", command: `jarvis unit ${ref}` });
  }

  actions.sort((a, b) => a.priority - b.priority);
  const score = Math.min(100, actions.reduce((s, a) => s + (a.priority === 1 ? 30 : a.priority === 2 ? 12 : 4), 0));
  return { unit: pick(u), company, score, actions, warnings };
}

function pick(u: Unit) {
  return { id: u.id, slug: u.slug, name: u.name, kind: u.kind, stage: u.stage, status: u.status, company_id: u.company_id };
}

export interface PortfolioNext {
  generated_at: string;
  top: (Action & { unit: string; company: string })[];
  units: UnitNext[];
  warnings: string[];
}

export function nextForPortfolio(scope?: string): PortfolioNext {
  const units = listUnits(scope).filter((u) => u.status === "active");
  const results = units.map(nextForUnit).sort((a, b) => b.score - a.score);
  const warnings: string[] = [];

  // Portfolio rule: one active build, one validation project (Brand95).
  const brandUnits = units.filter((u) => u.blueprint === "brand-blueprint");
  const buildStages = new Set(["brand", "product", "store", "launch"]);
  const inBuild = brandUnits.filter((u) => u.stage && buildStages.has(u.stage));
  const inValidation = brandUnits.filter((u) => u.stage && ["discover", "validate"].includes(u.stage));
  if (inBuild.length > 1) warnings.push(`Portfolio rule broken: ${inBuild.length} brands in Build (${inBuild.map((u) => u.name).join(", ")}). Rule is one.`);
  if (inValidation.length > 1) warnings.push(`Portfolio rule broken: ${inValidation.length} brands in Discover/Validate (${inValidation.map((u) => u.name).join(", ")}). Rule is one.`);
  const ventures = units.filter((u) => u.blueprint === "venture-validation" && u.stage && u.stage !== "intake");
  if (ventures.length > 2) warnings.push(`${ventures.length} ventures past intake. Fewer bets, higher conviction: pick two.`);

  const hot = results.filter((r) => r.score >= 30).length;
  if (hot >= 5) warnings.push(`${hot} units need founder attention this week. That is over-parallelization; delegate or park.`);

  const top = results
    .flatMap((r) => r.actions.filter((a) => a.priority === 1).map((a) => ({ ...a, unit: r.unit.name, company: r.company })))
    .slice(0, 5);

  for (const r of results) warnings.push(...r.warnings);
  return { generated_at: new Date().toISOString(), top, units: results, warnings };
}
