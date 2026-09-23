/** Dashboard server: static web/ + JSON API over the same services the CLI uses. No dependencies. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { all } from "../db/index.ts";
import { blueprints } from "../domain/blueprints.ts";
import * as P from "../services/portfolio.ts";
import * as W from "../services/work.ts";
import * as A from "../services/approvals.ts";
import * as L from "../services/pipeline.ts";
import { nextForPortfolio, nextForUnit } from "../engine/next.ts";
import { founderBrief } from "../engine/brief.ts";
import { unitDetail } from "../cli.ts";
import { cockpit } from "../engine/cockpit.ts";
import * as G from "../services/goals.ts";
import { chat, sessionHistory, clearSession, modelConfig } from "./chat.ts";
import { gate, authEnabled } from "./auth.ts";
import { importSnapshot, type Snapshot } from "../services/sync.ts";
import type { Server } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, "../../web");
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

type Body = Record<string, string | number | boolean | undefined | null | string[]>;

async function streamChat(res: ServerResponse, message: string, opts: { session?: string; deep?: boolean; unit?: string }): Promise<void> {
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
  res.flushHeaders?.();
  const send = (ev: unknown) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  if (!message.trim()) { send({ type: "error", message: "Empty message" }); return void res.end(); }
  try {
    for await (const ev of chat(message, opts)) send(ev);
  } catch (e) {
    send({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
  res.end();
}

export function serve(port: number, host?: string): Server {
  const bind = host ?? process.env.JARVIS_HOST ?? (authEnabled() ? "0.0.0.0" : "127.0.0.1");
  if (bind !== "127.0.0.1" && bind !== "localhost" && !authEnabled() && process.env.JARVIS_INSECURE !== "1") {
    throw new Error(`Refusing to bind ${bind} without JARVIS_PASSWORD. Set a password (or JARVIS_INSECURE=1 if you really know what you are doing).`);
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (await gate(req, res, url.pathname)) return;
      if (url.pathname === "/api/chat" && req.method === "POST") {
        const body = await readBody(req);
        return streamChat(res, String(body.message ?? ""), { session: body.session ? String(body.session) : undefined, deep: body.deep === true || body.deep === "true", unit: body.unit ? String(body.unit) : undefined });
      }
      if (url.pathname.startsWith("/api/")) {
        const body = req.method === "POST" ? await readBody(req) : {};
        const result = route(req.method ?? "GET", url, body);
        return json(res, 200, result ?? { ok: true });
      }
      return staticFile(res, url.pathname);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(res, message.startsWith("Unknown") || message.startsWith("Not found") ? 404 : 400, { error: message });
    }
  });
  server.listen(port, bind, () => {
    console.log(`Jarvis dashboard → http://${bind === "0.0.0.0" ? "0.0.0.0" : bind}:${port}${authEnabled() ? " (password protected)" : ""}`);
  });
  return server;
}

function route(method: string, url: URL, b: Body): unknown {
  const p = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  const s = (k: string) => (b[k] == null ? undefined : String(b[k]));
  const n = (k: string) => (b[k] == null || b[k] === "" ? undefined : Number(b[k]));

  if (method === "GET") {
    switch (p[0]) {
      case "cockpit": return cockpit();
      case "goals": return G.trackAll(q("company"));
      case "chat": return { history: sessionHistory(q("session") ?? "default"), config: { ...modelConfig(false), api_key: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) } };
      case "status": return { auth: authEnabled(), companies: P.listCompanies().map((c) => ({ ...c, units: P.listUnits(c.id).map((u) => ({ ...u, gate: P.gateStatus(u), open_tasks: W.listTasks(u.id).length, pending_approvals: A.listApprovals("pending", u.id).length, next: nextForUnit(u).actions.slice(0, 2) })) })), approvals: A.listApprovals("pending"), next: nextForPortfolio(), agent_runs: W.listAgentRuns(8), events: all("SELECT * FROM events ORDER BY ts DESC LIMIT 25") };
      case "next": return p[1] ? nextForUnit(P.requireUnit(decodeURIComponent(p[1]))) : nextForPortfolio(q("company"));
      case "brief": return { markdown: founderBrief(q("company")) };
      case "companies": return P.listCompanies();
      case "units": return P.listUnits(q("company"));
      case "unit": return unitDetail(P.requireUnit(decodeURIComponent(p[1])));
      case "approvals": return A.listApprovals(q("status") ?? "pending", q("unit"));
      case "tasks": return W.listTasks(q("unit"), q("status"));
      case "leads": return L.listLeads(q("unit"), q("status"));
      case "lead": return { lead: L.getLead(p[1]), outreach: L.listOutreach(undefined).filter((o) => o.lead_id === p[1]) };
      case "outreach": return L.listOutreach(q("unit"), q("status"));
      case "decisions": return W.listDecisions(q("unit"), q("status"));
      case "notes": return W.listNotes(q("unit"), q("kind"), Number(q("limit") ?? 50));
      case "note": return W.getNote(p[1]);
      case "experiments": return W.listExperiments(q("unit"));
      case "events": return all("SELECT * FROM events ORDER BY ts DESC LIMIT ?", Number(q("limit") ?? 50));
      case "agents": return W.listAgentRuns(Number(q("limit") ?? 20));
      case "blueprints": return [...blueprints().values()];
    }
    throw new Error(`Not found: ${url.pathname}`);
  }

  // POST
  switch (p[0]) {
    case "import": return importSnapshot(b as unknown as Snapshot);
    case "goals":
      if (p[2] === "progress") return G.setGoalProgress(p[1], Number(b.current), s("note"));
      return G.upsertGoal({ company: s("company")!, key: s("key")!, label: s("label") ?? s("key")!, target: Number(b.target), deadline: s("deadline")!, horizon: (s("horizon") as never) ?? "12m", unit: s("unit") || undefined, metric_key: s("metric_key"), baseline: n("baseline"), current: n("current"), unit_label: s("unit_label"), direction: (s("direction") as never) ?? "up" });
    case "chat":
      if (p[1] === "clear") return void clearSession(s("session") ?? "default");
      break;
    case "approvals":
      if (p[2] === "decide") return A.decideApproval(p[1], s("decision") as never, s("note"));
      if (p[2] === "executed") return A.markExecuted(p[1]);
      return A.requestApproval({ unit: s("unit") || null, kind: s("kind") ?? "other", title: s("title") ?? "Untitled", proposal: s("proposal") ?? "", why_now: s("why_now"), evidence: s("evidence"), exposure: s("exposure"), alternatives: s("alternatives"), recommendation: s("recommendation"), risk_level: n("risk_level"), requested_by: s("requested_by") });
    case "tasks":
      if (p[2] === "status") return W.setTaskStatus(p[1], s("status") as never, s("note"));
      return W.addTask(s("unit")!, s("title")!, { due: s("due") || undefined, priority: n("priority"), owner: s("owner") || undefined, notes: s("notes") || undefined });
    case "initiatives":
      if (p[2] === "close") return void W.closeInitiative(p[1], (s("status") as never) ?? "done");
      return W.addInitiative(s("unit")!, s("title")!, { objective: s("objective"), due: s("due") || undefined, priority: n("priority"), goal_id: s("goal") ? G.getGoal(s("goal")!)?.id : undefined });
    case "decisions":
      if (p[2] === "decide") return W.decide(p[1], s("decision")!, s("rationale"));
      return W.addDecision(s("unit") || null, s("title")!, { context: s("context"), options: Array.isArray(b.options) ? (b.options as string[]) : s("options")?.split("|").map((x) => x.trim()) });
    case "leads":
      if (p[1]) return L.updateLead(p[1], { status: s("status") as never, fit_score: n("fit_score"), contact_email: s("contact_email"), contact_name: s("contact_name"), contact_role: s("contact_role"), angle: s("angle"), research: s("research"), next_action_at: s("next_action_at"), website: s("website"), segment: s("segment"), country: s("country") });
      return L.addLead(s("unit")!, { company_name: s("company_name")!, segment: s("segment"), website: s("website"), country: s("country"), contact_name: s("contact_name"), contact_role: s("contact_role"), contact_email: s("contact_email"), fit_score: n("fit_score"), angle: s("angle"), source: s("source") ?? "dashboard" });
    case "outreach":
      if (p[1] === "batch") return L.requestOutreachBatchApproval(s("unit")!, { ids: Array.isArray(b.ids) ? (b.ids as string[]) : undefined, recommendation: s("recommendation") });
      if (p[2] === "sent") return L.markSent(p[1], s("external_id"));
      if (p[2] === "replied") return L.markReplied(p[1], s("note"));
      return L.draftOutreach(s("lead_id")!, { subject: s("subject"), body: s("body") ?? "", channel: s("channel"), sequence_step: n("sequence_step"), created_by: s("created_by") });
    case "gate": return P.markCriterion(s("unit")!, s("criterion")!, (s("status") as never) ?? "met", s("evidence"), s("stage"));
    case "advance": return P.advanceStage(s("unit")!, { force: b.force === "true" || b.force === 1, note: s("note") });
    case "metrics": return P.recordMetric(s("unit")!, s("key")!, Number(b.value), s("period") ?? new Date().toISOString().slice(0, 7), s("note"));
    case "experiments":
      if (p[1]) return W.setExperiment(p[1], { status: s("status"), result: s("result"), learning: s("learning") });
      return W.addExperiment(s("unit")!, s("hypothesis")!, { method: s("method"), metric: s("metric"), target: s("target") });
    case "notes": return W.addNote(s("unit") || null, s("title")!, s("body") ?? "", (s("kind") as never) ?? "note", s("author") ?? "founder");
    case "units":
      if (p[2] === "status") return P.setUnitStatus(p[1], s("status") as never, s("reason"));
      return P.createUnit({ company: s("company")!, slug: s("slug")!, name: s("name")!, kind: (s("kind") as never) ?? "concept", blueprint: s("blueprint")!, mission: s("mission") });
    case "agents":
      if (p[2] === "finish") return W.finishAgentRun(p[1], s("status") as never, s("summary") ?? "");
      return W.startAgentRun(s("agent")!, s("unit") || null, s("objective")!);
  }
  throw new Error(`Not found: ${method} ${url.pathname}`);
}

function readBody(req: IncomingMessage): Promise<Body> {
  return new Promise((res, rej) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { res(data ? JSON.parse(data) : {}); } catch (e) { rej(new Error("Invalid JSON body")); } });
    req.on("error", rej);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

function staticFile(res: ServerResponse, pathname: string): void {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(webDir, rel);
  if (!file.startsWith(webDir) || !existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return void res.end("not found");
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
}
