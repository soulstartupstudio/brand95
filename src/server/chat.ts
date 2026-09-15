/**
 * Talk to Jarvis. Streams Claude's answer token-by-token over SSE and lets it act on the
 * command center through a small set of tools (same services as the CLI and dashboard).
 * Nothing external happens here: tools only write to the local database; sends still go through approvals.
 */
import Anthropic from "@anthropic-ai/sdk";
import { all, insert, newId, now, run } from "../db/index.ts";
import * as P from "../services/portfolio.ts";
import * as W from "../services/work.ts";
import * as A from "../services/approvals.ts";
import * as L from "../services/pipeline.ts";
import * as G from "../services/goals.ts";
import { nextForPortfolio, nextForUnit } from "../engine/next.ts";
import { founderBrief } from "../engine/brief.ts";
import { cockpit } from "../engine/cockpit.ts";
import { unitDetail } from "../cli.ts";

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; summary: string }
  | { type: "done"; usage: { input: number; output: number; cache_read: number }; model: string; ms: number }
  | { type: "error"; message: string };

export interface ChatOptions { session?: string; deep?: boolean; unit?: string; }

// ---------------------------------------------------------------- model config

export function modelConfig(deep = false) {
  const model = process.env.JARVIS_MODEL ?? "claude-opus-5";
  const fast = process.env.JARVIS_FAST === "1" && /opus-5|opus-4-8/.test(model);
  const supportsEffort = !/haiku/.test(model);
  const effort = (process.env.JARVIS_EFFORT as "low" | "medium" | "high" | undefined) ?? (deep ? "high" : "low");
  return { model, fast, supportsEffort, effort };
}

// ---------------------------------------------------------------- system prompt (stable → cached)

const SYSTEM = `You are Jarvis, chief of staff and co-founder for Dex, who runs Custom95 (EU creative merchandise agency; departments: sales, operations, finance, marketing; new offers under validation), Brand95 (owned DTC/B2B brands on a stage-gated blueprint), Soul Startup Studio (venture validation), Student95 (student-association merch) and PortaPay (SaaS concept, validation only).

Operating style: founder-to-founder, calm, direct, slightly demanding. No hype, no filler, no motivational talk. Lead with the decision or next action, then why, then what happens next. Bullets over paragraphs. Max 3 options. One language per reply (English unless asked). Push back when something drifts from the North Star; say "this is noise" when it is. Think in constraints, second-order effects and leverage. Prefer asymmetric bets and steps that reduce founder dependency.

You have the live state of the command center in the second system block (companies, units, stages, gates, goals, approvals, next actions). Use it; do not ask for things it already tells you.

Tools write to the command center database. Rules:
- Anything external (sending email, spending, advancing a stage, publishing) is never done directly: create an approval request with request_approval and tell the founder it is waiting in the inbox. Drafting outreach is fine; sending is not.
- Only decide_approval when the founder explicitly says to approve/reject something in this conversation.
- Never mark a gate criterion met without evidence the founder gave you.
- Keep tool use minimal: read with get_unit only when the state block is not enough; write once per user intent.
- After acting, summarize what changed in one or two lines and propose the single next step.
Answer fast and short. Expand only when asked.`;

function stateSnapshot(unitRef?: string): string {
  const nx = nextForPortfolio();
  const cp = cockpit();
  const approvals = A.listApprovals("pending").map((a) => ({ id: a.id.slice(-6), unit: a.unit_id, kind: a.kind, title: a.title, risk: a.risk_level, recommendation: a.recommendation }));
  const companies = cp.companies.map((c) => ({
    slug: c.slug, name: c.name, north_star: c.north_star, level: `${c.level}/5 ${c.level_label}`, status: c.status,
    goals: c.goals.map((g) => ({ key: g.goal.key, label: g.goal.label, target: `${g.goal.target} ${g.goal.unit_label ?? ""}`.trim(), by: g.goal.deadline, current: g.current, status: g.status })),
    units: c.units.map((u) => ({ ref: `${c.slug}/${u.unit.slug}`, kind: u.unit.kind, status: u.unit.status, level: u.level, detail: u.detail, urgency: u.score })),
  }));
  const next = nx.units.filter((u) => u.actions.length).map((u) => ({ ref: `${u.company}/${u.unit.slug}`, actions: u.actions.slice(0, 3).map((a) => `${a.priority}: ${a.title}`) }));
  const focus = unitRef ? { unit: unitRef, detail: compactUnit(unitRef) } : undefined;
  return JSON.stringify({ today: now().slice(0, 10), score: cp.score, warnings: [...nx.warnings, ...cp.drift], approvals, companies, next, focus });
}

function compactUnit(ref: string) {
  const d = unitDetail(P.requireUnit(ref));
  return {
    unit: d.unit, gate: d.gate, metrics: d.metrics.map((m) => `${m.key}=${m.value} (${m.period})`),
    initiatives: d.initiatives.map((i) => `${i.id.slice(-6)} ${i.title}`), tasks: d.tasks.map((t) => `${t.id.slice(-6)} P${t.priority} ${t.status} ${t.title}${t.due ? " due " + t.due : ""}`),
    decisions: d.decisions.map((x) => `${x.id.slice(-6)} ${x.title} options=${x.options}`), experiments: d.experiments.map((e) => `${e.id.slice(-6)} ${e.status} ${e.hypothesis}`),
    pipeline: d.pipeline, leads: d.leads.slice(0, 30).map((l) => `${l.id.slice(-6)} fit${l.fit_score ?? "-"} ${l.status} ${l.company_name}${l.angle ? " · " + l.angle : ""}`),
    outreach: d.outreach.slice(0, 20).map((o) => `${o.id.slice(-6)} ${o.status} ${o.company_name}: ${o.subject ?? ""}`), notes: d.notes.slice(0, 10).map((n) => `${n.id.slice(-6)} ${n.kind} ${n.title}`),
  };
}

// ---------------------------------------------------------------- tools

type Schema = { type: "object"; properties: Record<string, { type: string; description?: string; enum?: string[] }>; required: string[]; additionalProperties: false };
const S = (properties: Schema["properties"], required: string[]): Schema => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string, e?: string[]) => ({ type: "string", description, ...(e ? { enum: e } : {}) });
const num = (description: string) => ({ type: "number", description });

interface ToolDef { name: string; description: string; input_schema: Schema; run: (i: Record<string, unknown>) => unknown; }

const TOOLS: ToolDef[] = [
  { name: "get_unit", description: "Full detail of one unit (company/slug): gate, tasks, initiatives, leads, outreach, experiments, notes, next actions.", input_schema: S({ ref: str("Unit ref like custom95/sales") }, ["ref"]), run: (i) => compactUnit(i.ref as string) },
  { name: "get_brief", description: "The founder brief in markdown.", input_schema: S({}, []), run: () => founderBrief() },
  { name: "next_actions", description: "Ranked next actions for one unit.", input_schema: S({ ref: str("Unit ref") }, ["ref"]), run: (i) => nextForUnit(P.requireUnit(i.ref as string)) },
  { name: "add_task", description: "Create a task on a unit.", input_schema: S({ ref: str("Unit ref"), title: str("Task title"), priority: num("1 high, 2 normal, 3 low"), due: str("YYYY-MM-DD"), owner: str("founder, agent:<name>, or a person") }, ["ref", "title"]), run: (i) => W.addTask(i.ref as string, i.title as string, { priority: i.priority as number | undefined, due: i.due as string | undefined, owner: i.owner as string | undefined }) },
  { name: "complete_task", description: "Mark a task done (or dropped).", input_schema: S({ id: str("Task id or last 6 chars"), status: str("done or dropped", ["done", "dropped"]) }, ["id"]), run: (i) => W.setTaskStatus(i.id as string, ((i.status as string) ?? "done") as never) },
  { name: "add_initiative", description: "Create an initiative (max 3 active per unit) and optionally link it to a goal key.", input_schema: S({ ref: str("Unit ref"), title: str("Initiative"), objective: str("Measurable outcome"), goal: str("Goal ref company/key to link"), due: str("YYYY-MM-DD") }, ["ref", "title"]), run: (i) => W.addInitiative(i.ref as string, i.title as string, { objective: i.objective as string | undefined, due: i.due as string | undefined, goal_id: i.goal ? G.getGoal(i.goal as string)?.id : undefined }) },
  { name: "request_approval", description: "Create an approval request for anything external, irreversible or strategic. The founder decides in the inbox.", input_schema: S({ ref: str("Unit ref or 'portfolio'"), kind: str("Kind", ["next_step", "outreach_batch", "stage_gate", "spend", "publish", "other"]), title: str("Verb + object"), proposal: str("Exactly what will happen"), why_now: str("Which constraint it removes"), evidence: str("Data supporting it"), exposure: str("Cost, time, reversibility"), alternatives: str("Two alternatives"), recommendation: str("Your recommendation"), risk_level: num("0 internal, 1 batch, 2 single external/spend, 3 founder-only") }, ["ref", "kind", "title", "proposal", "risk_level"]), run: (i) => A.requestApproval({ unit: i.ref === "portfolio" ? null : (i.ref as string), kind: i.kind as string, title: i.title as string, proposal: i.proposal as string, why_now: i.why_now as string | undefined, evidence: i.evidence as string | undefined, exposure: i.exposure as string | undefined, alternatives: i.alternatives as string | undefined, recommendation: i.recommendation as string | undefined, risk_level: i.risk_level as number, requested_by: "agent:jarvis-chat" }) },
  { name: "decide_approval", description: "Approve, reject or request changes on an approval. Only when the founder explicitly asked for it in this conversation.", input_schema: S({ id: str("Approval id or last 6 chars"), decision: str("Decision", ["approved", "rejected", "changes_requested"]), note: str("Note") }, ["id", "decision"]), run: (i) => A.decideApproval(i.id as string, i.decision as never, i.note as string | undefined) },
  { name: "decide", description: "Record a decision on an open decision.", input_schema: S({ id: str("Decision id or last 6 chars"), decision: str("The choice"), rationale: str("Why") }, ["id", "decision"]), run: (i) => W.decide(i.id as string, i.decision as string, i.rationale as string | undefined) },
  { name: "add_lead", description: "Add a B2B lead to a sales unit.", input_schema: S({ ref: str("Unit ref"), company_name: str("Company"), segment: str("fmcg, tech, travel, agency, student, retailer"), website: str("URL"), country: str("CC"), contact_name: str("Name"), contact_role: str("Role"), contact_email: str("Email"), fit_score: num("0-100"), angle: str("Why-now hook"), research: str("Research note") }, ["ref", "company_name"]), run: (i) => L.addLead(i.ref as string, { company_name: i.company_name as string, segment: i.segment as string | undefined, website: i.website as string | undefined, country: i.country as string | undefined, contact_name: i.contact_name as string | undefined, contact_role: i.contact_role as string | undefined, contact_email: i.contact_email as string | undefined, fit_score: i.fit_score as number | undefined, angle: i.angle as string | undefined, research: i.research as string | undefined, source: "chat" }) },
  { name: "update_lead", description: "Update a lead's status, fit, angle, research or contact.", input_schema: S({ id: str("Lead id or last 6 chars"), status: str("Status", ["new", "researched", "queued", "contacted", "replied", "meeting", "proposal", "won", "lost", "disqualified"]), fit_score: num("0-100"), angle: str("Angle"), research: str("Research"), contact_email: str("Email"), contact_name: str("Name") }, ["id"]), run: (i) => L.updateLead(i.id as string, { status: i.status as never, fit_score: i.fit_score as number | undefined, angle: i.angle as string | undefined, research: i.research as string | undefined, contact_email: i.contact_email as string | undefined, contact_name: i.contact_name as string | undefined }) },
  { name: "draft_outreach", description: "Save an outreach draft for a lead (not sent).", input_schema: S({ lead_id: str("Lead id or last 6 chars"), subject: str("Subject"), body: str("Body"), step: num("Sequence step") }, ["lead_id", "body"]), run: (i) => L.draftOutreach(i.lead_id as string, { subject: i.subject as string | undefined, body: i.body as string, sequence_step: i.step as number | undefined, created_by: "agent:jarvis-chat" }) },
  { name: "batch_outreach_approval", description: "Bundle a unit's unbundled drafts into one batch approval.", input_schema: S({ ref: str("Unit ref"), recommendation: str("What to spot-check") }, ["ref"]), run: (i) => L.requestOutreachBatchApproval(i.ref as string, { recommendation: i.recommendation as string | undefined }) },
  { name: "add_note", description: "Store a note, memo, research or feedback on a unit.", input_schema: S({ ref: str("Unit ref or 'portfolio'"), title: str("Title"), body: str("Markdown"), kind: str("Kind", ["note", "research", "feedback", "memo"]) }, ["ref", "title", "body"]), run: (i) => W.addNote(i.ref === "portfolio" ? null : (i.ref as string), i.title as string, i.body as string, ((i.kind as string) ?? "note") as never, "agent:jarvis-chat") },
  { name: "mark_gate", description: "Mark a gate criterion met/waived/open with evidence the founder provided.", input_schema: S({ ref: str("Unit ref"), criterion: str("Criterion key"), status: str("Status", ["met", "waived", "open"]), evidence: str("Evidence") }, ["ref", "criterion", "status"]), run: (i) => P.markCriterion(i.ref as string, i.criterion as string, i.status as never, i.evidence as string | undefined) },
  { name: "add_experiment", description: "Log a validation experiment on a unit.", input_schema: S({ ref: str("Unit ref"), hypothesis: str("We believe … will …"), method: str("landing_page, waitlist, preorder, interviews, outreach_test, pricing_test, pilot, retailer_test"), metric: str("Metric"), target: str("Target in time-box") }, ["ref", "hypothesis"]), run: (i) => W.addExperiment(i.ref as string, i.hypothesis as string, { method: i.method as string | undefined, metric: i.metric as string | undefined, target: i.target as string | undefined }) },
  { name: "record_metric", description: "Record a KPI value for a unit and period.", input_schema: S({ ref: str("Unit ref"), key: str("KPI key from the blueprint"), value: num("Value"), period: str("YYYY-MM (default current month)") }, ["ref", "key", "value"]), run: (i) => P.recordMetric(i.ref as string, i.key as string, i.value as number, (i.period as string) ?? now().slice(0, 7)) },
  { name: "set_goal_progress", description: "Record the current value of a goal (company/key).", input_schema: S({ goal: str("Goal ref company/key"), current: num("Current value"), note: str("Source / note") }, ["goal", "current"]), run: (i) => G.setGoalProgress(i.goal as string, i.current as number, i.note as string | undefined) },
  { name: "set_unit_status", description: "Park, activate or kill a unit.", input_schema: S({ ref: str("Unit ref"), status: str("Status", ["active", "parked", "killed"]), reason: str("Why") }, ["ref", "status"]), run: (i) => P.setUnitStatus(i.ref as string, i.status as never, i.reason as string | undefined) },
];

function validate(schema: Schema, input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "input is not an object";
  const obj = input as Record<string, unknown>;
  for (const r of schema.required) if (obj[r] === undefined || obj[r] === null || obj[r] === "") return `missing required field ${r}`;
  for (const [k, v] of Object.entries(obj)) {
    const p = schema.properties[k];
    if (!p) return `unknown field ${k}`;
    if (v === null || v === undefined) continue;
    if (p.type === "number" && typeof v !== "number") return `${k} must be a number`;
    if (p.type === "string" && typeof v !== "string") return `${k} must be a string`;
    if (p.enum && !p.enum.includes(v as string)) return `${k} must be one of ${p.enum.join(", ")}`;
  }
  return null;
}

const apiTools: Anthropic.Beta.BetaToolUnion[] = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema, strict: true, eager_input_streaming: true }));

// ---------------------------------------------------------------- history

function loadHistory(session: string, limit = 40): Anthropic.Beta.BetaMessageParam[] {
  const rows = all<{ role: string; content: string }>("SELECT role, content FROM chat_messages WHERE session = ? ORDER BY created_at DESC LIMIT ?", session, limit).reverse();
  const msgs = rows.map((r) => ({ role: r.role as "user" | "assistant", content: JSON.parse(r.content) as Anthropic.Beta.BetaMessageParam["content"] }));
  // history must start with a user turn and end with an assistant turn
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  while (msgs.length && msgs[msgs.length - 1].role !== "assistant") msgs.pop();
  return msgs;
}

function saveMessage(session: string, role: "user" | "assistant", content: unknown): void {
  insert("chat_messages", { id: newId(), session, role, content: JSON.stringify(content), created_at: now() });
}

export function clearSession(session: string): void {
  run("DELETE FROM chat_messages WHERE session = ?", session);
}

export function sessionHistory(session: string): { role: string; content: unknown; created_at: string }[] {
  return all<{ role: string; content: string; created_at: string }>("SELECT role, content, created_at FROM chat_messages WHERE session = ? ORDER BY created_at", session)
    .map((r) => ({ role: r.role, content: JSON.parse(r.content), created_at: r.created_at }));
}

// ---------------------------------------------------------------- the loop

export async function* chat(userText: string, opts: ChatOptions = {}): AsyncGenerator<ChatEvent> {
  const session = opts.session ?? "default";
  const t0 = Date.now();
  const cfg = modelConfig(opts.deep);
  let client: Anthropic;
  try { client = new Anthropic(); } catch (e) { yield { type: "error", message: e instanceof Error ? e.message : String(e) }; return; }

  const history = loadHistory(session);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: userText }];
  saveMessage(session, "user", userText);

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: "Live state:\n" + stateSnapshot(opts.unit) },
  ];
  const usage = { input: 0, output: 0, cache_read: 0 };
  const turnContent: Anthropic.Beta.BetaContentBlockParam[] = [];

  for (let iter = 0; iter < 8; iter++) {
    const stream = client.beta.messages.stream({
      model: cfg.model,
      max_tokens: 16000,
      system,
      messages,
      tools: apiTools,
      ...(cfg.supportsEffort ? { output_config: { effort: cfg.effort } } : {}),
      ...(cfg.fast ? { speed: "fast" as const, betas: ["fast-mode-2026-02-01"] } : {}),
    });
    const queue: ChatEvent[] = [];
    stream.on("text", (delta) => queue.push({ type: "text", text: delta }));
    // drain text events while the stream runs
    const final = stream.finalMessage();
    let done = false;
    final.then(() => (done = true), () => (done = true));
    while (!done || queue.length) {
      if (queue.length) { yield queue.shift()!; continue; }
      await new Promise((r) => setTimeout(r, 15));
    }
    let message: Anthropic.Beta.BetaMessage;
    try { message = await final; } catch (e) {
      const msg = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}`.trim() : e instanceof Error ? e.message : String(e);
      yield { type: "error", message: msg }; return;
    }
    usage.input += message.usage.input_tokens; usage.output += message.usage.output_tokens; usage.cache_read += message.usage.cache_read_input_tokens ?? 0;

    const blocks = message.content.filter((b) => b.type === "text" || b.type === "tool_use") as Anthropic.Beta.BetaContentBlockParam[];
    turnContent.push(...blocks);
    if (message.stop_reason === "refusal") { yield { type: "error", message: "The model declined this request." }; break; }
    if (message.stop_reason === "max_tokens") { yield { type: "error", message: "Response cut off (max_tokens)." }; break; }
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      yield { type: "tool", name: tu.name, input: tu.input };
      const def = TOOLS.find((t) => t.name === tu.name);
      const err = def ? validate(def.input_schema, tu.input) : "unknown tool";
      if (!def || err) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err ?? "unknown tool" });
        yield { type: "tool_result", name: tu.name, ok: false, summary: err ?? "unknown tool" };
        continue;
      }
      try {
        const out = def.run(tu.input as Record<string, unknown>);
        const text = typeof out === "string" ? out : JSON.stringify(out);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: text.slice(0, 20000) });
        yield { type: "tool_result", name: tu.name, ok: true, summary: summarizeResult(out) };
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: m });
        yield { type: "tool_result", name: tu.name, ok: false, summary: m };
      }
    }
    messages.push({ role: "user", content: results });
  }
  if (turnContent.length) saveMessage(session, "assistant", turnContent.filter((b) => b.type === "text"));
  yield { type: "done", usage, model: cfg.model + (cfg.fast ? " (fast)" : ""), ms: Date.now() - t0 };
}

function summarizeResult(out: unknown): string {
  if (typeof out === "string") return out.slice(0, 120);
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    const id = typeof o.id === "string" ? "#" + o.id.slice(-6) : "";
    const label = (o.title ?? o.company_name ?? o.hypothesis ?? o.label ?? o.name ?? o.key ?? "") as string;
    return `${id} ${label}`.trim() || "ok";
  }
  return "ok";
}

/** CLI: stream a reply to stdout. */
export async function chatToStdout(text: string, opts: ChatOptions): Promise<void> {
  for await (const ev of chat(text, opts)) {
    if (ev.type === "text") process.stdout.write(ev.text);
    else if (ev.type === "tool") process.stdout.write(`\n[${ev.name} ${JSON.stringify(ev.input)}]\n`);
    else if (ev.type === "tool_result") process.stdout.write(`[→ ${ev.ok ? "ok" : "error"}: ${ev.summary}]\n`);
    else if (ev.type === "error") process.stdout.write(`\n! ${ev.message}\n`);
    else if (ev.type === "done") process.stdout.write(`\n— ${ev.model} · ${ev.ms} ms · ${ev.usage.input} in / ${ev.usage.output} out (${ev.usage.cache_read} cached)\n`);
  }
}
