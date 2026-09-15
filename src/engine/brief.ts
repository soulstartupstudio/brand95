/** Founder brief: markdown snapshot of the whole portfolio, used by `jarvis brief` and the /brief skill. */
import { listCompanies, listUnits, gateStatus, latestMetrics } from "../services/portfolio.ts";
import { listApprovals } from "../services/approvals.ts";
import { listTasks, overdueTasks, listInitiatives, listAgentRuns } from "../services/work.ts";
import { pipelineSummary, listOutreach } from "../services/pipeline.ts";
import { blueprint } from "../domain/blueprints.ts";
import { nextForPortfolio } from "./next.ts";

export function founderBrief(scope?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const companies = listCompanies().filter((c) => !scope || c.slug === scope || c.id === scope);
  const nx = nextForPortfolio(scope);
  const approvals = listApprovals("pending");
  const lines: string[] = [];

  lines.push(`# Founder brief · ${today}`);
  lines.push("");
  lines.push(`## Do today`);
  if (nx.top.length === 0) lines.push("- Nothing urgent. Pick the highest-leverage initiative and go deep.");
  for (const a of nx.top) lines.push(`- **[${a.company}/${a.unit}]** ${a.title}${a.command ? `  \n  \`${a.command}\`` : ""}`);
  lines.push("");

  if (nx.warnings.length) {
    lines.push(`## Warnings`);
    for (const w of nx.warnings) lines.push(`- ${w}`);
    lines.push("");
  }

  lines.push(`## Approvals inbox (${approvals.length})`);
  if (approvals.length === 0) lines.push("- Empty.");
  for (const a of approvals) lines.push(`- \`${a.id.slice(-6)}\` L${a.risk_level} · ${a.kind} · ${a.title} — *${a.recommendation ?? "no recommendation"}*`);
  lines.push("");

  for (const c of companies) {
    const units = listUnits(c.id);
    lines.push(`## ${c.name}`);
    if (c.north_star) lines.push(`*North star: ${c.north_star}*`);
    for (const u of units) {
      const bp = blueprint(u.blueprint);
      const tasks = listTasks(u.id);
      const od = overdueTasks(u.id).length;
      const inits = listInitiatives(u.id);
      const un = nx.units.find((x) => x.unit.id === u.id);
      let head = `### ${u.name}`;
      if (u.status !== "active") head += ` _(${u.status})_`;
      lines.push(head);
      if (bp.kind === "validation") {
        const gs = gateStatus(u);
        if (gs) lines.push(`- Stage **${gs.name}** · gate ${gs.met}/${gs.total}${gs.complete ? " ✅ complete" : ""}`);
      } else {
        const m = latestMetrics(u.id);
        if (m.length) lines.push(`- KPIs: ${m.map((x) => `${x.key}=${x.value} (${x.period})`).join(", ")}`);
        if (bp.key === "dept-sales") {
          const ps = pipelineSummary(u.id);
          const total = Object.values(ps).reduce((a, b) => a + b, 0);
          lines.push(`- Pipeline: ${total} leads · ${Object.entries(ps).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
          const drafts = listOutreach(u.id, "draft").length;
          const approved = listOutreach(u.id, "approved").length;
          if (drafts || approved) lines.push(`- Outreach: ${drafts} drafts, ${approved} approved and ready to send`);
        }
      }
      lines.push(`- Initiatives: ${inits.length ? inits.map((i) => i.title).join("; ") : "none"}`);
      lines.push(`- Open tasks: ${tasks.length}${od ? ` (${od} overdue)` : ""}`);
      if (un && un.actions.length) lines.push(`- Next: ${un.actions[0].title}`);
    }
    lines.push("");
  }

  const runs = listAgentRuns(5);
  if (runs.length) {
    lines.push(`## Recent agent runs`);
    for (const r of runs) lines.push(`- ${r.agent} · ${r.status} · ${r.objective}${r.summary ? ` — ${r.summary}` : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
