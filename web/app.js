/* JARVIS command center — vanilla JS, talks to /api. */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const short = (id) => (id ? String(id).slice(-6) : "");
const fmtDate = (s) => (s ? String(s).slice(0, 10) : "");
const pill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;

async function api(path, body) {
  const res = await fetch("/api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(msg, err = false) {
  const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 5000 : 2200);
}
async function act(path, body, okMsg = "Done") {
  try { await api(path, body); toast(okMsg); await render(); } catch (e) { toast(e.message, true); }
}
function formData(form) {
  const o = {}; new FormData(form).forEach((v, k) => { if (v !== "") o[k] = v; }); return o;
}
window.submitForm = async (ev, path, okMsg) => { ev.preventDefault(); await act(path, formData(ev.target), okMsg); };

let state = { status: null, companies: [] };

// ---------------------------------------------------------------- routing
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [view, ...rest] = h.split("/");
  return { view: view || "overview", args: rest.map(decodeURIComponent) };
}
window.addEventListener("hashchange", render);

async function render() {
  const r = route();
  state.status = await api("status");
  state.companies = state.status.companies;
  renderSidebar(r);
  const main = $("#main");
  try {
    if (r.view === "overview") main.innerHTML = viewOverview();
    else if (r.view === "approvals") main.innerHTML = await viewApprovals();
    else if (r.view === "brief") main.innerHTML = await viewBrief();
    else if (r.view === "agents") main.innerHTML = await viewAgents();
    else if (r.view === "company") main.innerHTML = viewCompany(r.args[0]);
    else if (r.view === "unit") main.innerHTML = await viewUnit(r.args[0] + "/" + r.args[1], r.args[2] || "next");
    else main.innerHTML = `<div class="empty">Unknown view</div>`;
  } catch (e) { main.innerHTML = `<div class="card"><h2>Error</h2><p>${esc(e.message)}</p></div>`; }
}

function renderSidebar(r) {
  const s = state.status;
  const pending = s.approvals.length;
  const urgent = s.next.top.length;
  const active = (v, a0) => (r.view === v && (a0 === undefined || r.args[0] === a0) ? "active" : "");
  let html = `<div class="logo"><div class="orb"></div><div><b>JARVIS</b><small>FOUNDER COMMAND CENTER</small></div></div><nav>`;
  html += `<a href="#/" class="${active("overview")}">Overview ${urgent ? `<span class="badge warn">${urgent}</span>` : ""}</a>`;
  html += `<a href="#/approvals" class="${active("approvals")}">Approvals ${pending ? `<span class="badge">${pending}</span>` : `<span class="badge dim">0</span>`}</a>`;
  html += `<a href="#/brief" class="${active("brief")}">Founder brief</a>`;
  html += `<a href="#/agents" class="${active("agents")}">Agents</a>`;
  for (const c of s.companies) {
    html += `<div class="company"><a href="#/company/${c.slug}" class="${active("company", c.slug)}">${esc(c.name)}</a></div>`;
    for (const u of c.units) {
      const un = s.next.units.find((x) => x.unit.id === u.id);
      const heat = u.status !== "active" ? "off" : (un?.score ?? 0) >= 30 ? "hot" : (un?.score ?? 0) >= 12 ? "warm" : "cool";
      const stage = u.gate ? `${u.gate.met}/${u.gate.total}` : "";
      html += `<a href="#/unit/${c.slug}/${u.slug}" class="${r.view === "unit" && r.args[0] === c.slug && r.args[1] === u.slug ? "active" : ""}"><span><i class="dot ${heat}"></i>${esc(u.name)}</span><span class="stage">${u.pending_approvals ? `<span class="badge">${u.pending_approvals}</span> ` : ""}${esc(u.stage ? u.stage + " " + stage : "")}</span></a>`;
    }
  }
  html += `</nav>`;
  $("#sidebar").innerHTML = html;
}

// ---------------------------------------------------------------- views
function actionList(actions, withUnit = false) {
  if (!actions.length) return `<div class="empty">Nothing here.</div>`;
  return `<ul class="actions">${actions.map((a) => `<li><span class="p p${a.priority}">${a.priority}</span><div>${withUnit ? `<div class="unit">${esc(a.company)}/${esc(a.unit)}</div>` : ""}<div class="t">${esc(a.title)}</div><div class="why">${esc(a.why)}</div>${a.command ? `<div class="cmd">$ ${esc(a.command)}</div>` : ""}${a.agent ? `<div class="unit">agent: ${esc(a.agent)}</div>` : ""}</div></li>`).join("")}</ul>`;
}
function warnings(ws) {
  return ws.length ? `<div class="warnings">${ws.map((w) => `<div>⚠ ${esc(w)}</div>`).join("")}</div>` : "";
}

function viewOverview() {
  const s = state.status;
  const totalUnits = s.companies.reduce((n, c) => n + c.units.filter((u) => u.status === "active").length, 0);
  const openTasks = s.companies.reduce((n, c) => n + c.units.reduce((m, u) => m + u.open_tasks, 0), 0);
  return `
  <div class="topbar"><div><h1>Overview</h1><div class="crumbs">${new Date().toISOString().slice(0, 10)} · <b>${s.approvals.length}</b> approvals · <b>${s.next.top.length}</b> urgent</div></div>
    <div class="row-actions"><a href="#/brief"><button>Founder brief</button></a><a href="#/approvals"><button class="primary">Approvals inbox</button></a></div></div>
  ${warnings(s.next.warnings)}
  <div class="grid cols-3" style="margin-bottom:16px">
    <div class="card stat"><b>${s.approvals.length}</b><span>approvals waiting on you</span></div>
    <div class="card stat"><b>${totalUnits}</b><span>active units across ${s.companies.length} companies</span></div>
    <div class="card stat"><b>${openTasks}</b><span>open tasks</span></div>
  </div>
  <div class="grid cols-2">
    <div class="card ${s.next.top.length ? "hot" : ""}"><h2>Do today</h2>${actionList(s.next.top, true)}</div>
    <div>
      ${s.companies.map((c) => `<div class="card" style="margin-bottom:12px"><h3><a href="#/company/${c.slug}">${esc(c.name)}</a><span class="dim mono" style="font-size:11px">${esc(c.kind)}</span></h3>
        ${c.units.length ? `<table>${c.units.map((u) => { const un = s.next.units.find((x) => x.unit.id === u.id); return `<tr><td><a href="#/unit/${c.slug}/${u.slug}">${esc(u.name)}</a></td><td class="mono dim">${u.gate ? `${esc(u.gate.name)} ${u.gate.met}/${u.gate.total}` : u.kind}</td><td class="muted" style="font-size:12px">${esc(un?.actions[0]?.title ?? "")}</td></tr>`; }).join("")}</table>` : `<div class="empty">No units yet. Add one with <code>jarvis unit add ${esc(c.slug)} &lt;slug&gt; "Name" --kind concept --blueprint venture-validation</code></div>`}
      </div>`).join("")}
    </div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Recent activity</h3><ul class="timeline">${s.events.slice(0, 12).map((e) => `<li><span class="ts">${esc(e.ts).slice(0, 16).replace("T", " ")}</span><span class="actor">${esc(e.actor)}</span><span>${esc(e.type)} <span class="dim">${esc(summarize(e.payload))}</span></span></li>`).join("")}</ul></div>`;
}
function summarize(payload) { try { const o = JSON.parse(payload); return Object.entries(o).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => `${k}=${v}`).join(" ").slice(0, 90); } catch { return ""; } }

function viewCompany(slug) {
  const c = state.companies.find((x) => x.slug === slug);
  if (!c) return `<div class="empty">Unknown company</div>`;
  const s = state.status;
  const units = s.next.units.filter((u) => u.company === slug);
  return `
  <div class="topbar"><div><h1>${esc(c.name)}</h1><div class="mission">${esc(c.north_star ?? "")}</div></div></div>
  ${warnings(units.flatMap((u) => u.warnings))}
  <div class="grid cols-2">
    ${c.units.map((u) => { const un = s.next.units.find((x) => x.unit.id === u.id); return `<div class="card ${un && un.score >= 30 ? "hot" : ""}"><h2><a href="#/unit/${c.slug}/${u.slug}">${esc(u.name)}</a><span class="dim mono" style="font-size:11px">${esc(u.kind)} · ${esc(u.status)}</span></h2>
      ${u.gate ? `<div class="mono dim" style="font-size:12px">${esc(u.gate.name)} · gate ${u.gate.met}/${u.gate.total}</div><div class="progress"><i style="width:${u.gate.total ? (100 * u.gate.met) / u.gate.total : 0}%"></i></div>` : ""}
      <div class="dim" style="font-size:12px;margin-bottom:8px">${u.open_tasks} open tasks · ${u.pending_approvals} approvals</div>
      ${actionList((un?.actions ?? []).slice(0, 3))}</div>`; }).join("")}
  </div>
  <div class="card" style="margin-top:16px"><h3>Add a unit to ${esc(c.name)}</h3>
    <form class="form" onsubmit="submitForm(event,'units','Unit created')"><input type="hidden" name="company" value="${esc(c.slug)}">
      <div class="row"><div><label>Slug</label><input name="slug" required placeholder="my-concept"></div><div><label>Name</label><input name="name" required placeholder="My Concept"></div>
      <div><label>Kind</label><select name="kind"><option>concept</option><option>venture</option><option>brand</option><option>department</option></select></div>
      <div><label>Blueprint</label><select name="blueprint"><option>venture-validation</option><option>offer-validation</option><option>brand-blueprint</option><option>dept-sales</option><option>dept-operations</option><option>dept-finance</option><option>dept-marketing</option></select></div></div>
      <div><label>Mission</label><input name="mission" placeholder="One sentence: what this unit must prove or deliver"></div><div><button class="primary">Create</button></div></form></div>`;
}

async function viewApprovals() {
  const all = await api("approvals?status=all");
  const pending = all.filter((a) => a.status === "pending");
  const history = all.filter((a) => a.status !== "pending").slice(0, 20);
  const unitName = (id) => { for (const c of state.companies) for (const u of c.units) if (u.id === id) return `${c.slug}/${u.slug}`; return "portfolio"; };
  const card = (a, withButtons) => `<div class="card approval l${a.risk_level}">
    <h2>${esc(a.title)} ${pill(a.status)}</h2>
    <div class="meta"><span>L${a.risk_level} ${["autonomous", "batch", "single action", "founder-only"][a.risk_level] ?? ""}</span><span>${esc(a.kind)}</span><span>${esc(unitName(a.unit_id))}</span><span>by ${esc(a.requested_by)}</span><span>${fmtDate(a.created_at)}</span><span>#${short(a.id)}</span></div>
    <dl><dt>Proposal</dt><dd>${esc(a.proposal)}</dd>${a.why_now ? `<dt>Why now</dt><dd>${esc(a.why_now)}</dd>` : ""}${a.evidence ? `<dt>Evidence</dt><dd>${esc(a.evidence)}</dd>` : ""}${a.exposure ? `<dt>Exposure</dt><dd>${esc(a.exposure)}</dd>` : ""}${a.alternatives ? `<dt>Alternatives</dt><dd>${esc(a.alternatives)}</dd>` : ""}${a.recommendation ? `<dt>Recommendation</dt><dd><b>${esc(a.recommendation)}</b></dd>` : ""}${a.note ? `<dt>Your note</dt><dd>${esc(a.note)}</dd>` : ""}</dl>
    ${withButtons ? `<div class="buttons"><input id="note-${a.id}" placeholder="Note (optional, required for changes)"><button class="primary" onclick="decideApproval('${a.id}','approved')">Approve</button><button onclick="decideApproval('${a.id}','changes_requested')">Request changes</button><button class="danger" onclick="decideApproval('${a.id}','rejected')">Reject</button></div>` : ""}
  </div>`;
  return `<div class="topbar"><div><h1>Approvals</h1><div class="crumbs">The only door to anything external, irreversible, or strategic.</div></div></div>
    <div class="grid" style="gap:12px">${pending.length ? pending.map((a) => card(a, true)).join("") : `<div class="empty">Inbox empty. Agents have nothing waiting on you.</div>`}</div>
    ${history.length ? `<h4 style="margin:26px 0 10px">History</h4><div class="grid" style="gap:12px">${history.map((a) => card(a, false)).join("")}</div>` : ""}`;
}
window.decideApproval = async (id, decision) => {
  const note = $(`#note-${id}`)?.value || undefined;
  if (decision === "changes_requested" && !note) return toast("Add a note describing the changes", true);
  await act(`approvals/${id}/decide`, { decision, note }, `Approval ${decision}`);
};

async function viewBrief() {
  const { markdown } = await api("brief");
  return `<div class="topbar"><div><h1>Founder brief</h1><div class="crumbs">Same output as <code>jarvis brief</code>. Paste into Claude with <code>/brief</code> for judgment on top.</div></div>
    <button onclick="navigator.clipboard.writeText(${JSON.stringify(markdown).replace(/"/g, "&quot;")}).then(()=>toast('Copied'))">Copy markdown</button></div>
    <div class="card md">${md(markdown)}</div>`;
}
function md(src) {
  const lines = src.split("\n"); let out = ""; let inList = false;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/_\(([^)]+)\)_/g, "<em>($1)</em>");
  for (const l of lines) {
    if (/^\s*- /.test(l)) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(l.replace(/^\s*- /, ""))}</li>`; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    if (/^### /.test(l)) out += `<h3>${inline(l.slice(4))}</h3>`;
    else if (/^## /.test(l)) out += `<h2>${inline(l.slice(3))}</h2>`;
    else if (/^# /.test(l)) out += `<h1>${inline(l.slice(2))}</h1>`;
    else if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  if (inList) out += "</ul>";
  return out;
}

async function viewAgents() {
  const runs = await api("agents?limit=30");
  const agents = [
    ["cofounder", "Reads the whole portfolio, proposes the next step, writes an approval request, waits for your decision.", "/next"],
    ["lead-researcher", "Finds and researches B2B accounts for a sales unit; stores research + angle on each lead.", "/research-leads custom95/sales fmcg 10"],
    ["outreach-writer", "Drafts personalized outreach for researched leads; bundles into one batch approval.", "/outreach custom95/sales"],
    ["outreach-sender", "Sends approved drafts through the Gmail connector and marks them sent. Never sends unapproved.", "/send-approved custom95/sales"],
    ["research", "Market, customer, competitor and price research for a brand or venture stage. Sources + dates.", "/research brand95/camera95"],
    ["concept-validator", "Designs the cheapest experiment for the open gate criteria and logs it.", "/validate portapay/validation"],
    ["writer", "Memos, one-pagers, decks, SOPs, landing-page copy in your voice.", "/write custom95/brandshops one-pager"],
    ["finance", "Pulls Moneybird numbers into KPIs; flags margin and cash risk.", "/finance-review"],
    ["ops", "Weekly operating review: exceptions, SOP gaps, automation health.", "/ops-review"],
  ];
  return `<div class="topbar"><div><h1>Agents</h1><div class="crumbs">Agents run inside Claude Code in this repo. They read and write this database through the <code>jarvis</code> CLI and never act externally without an approval.</div></div></div>
  <div class="grid cols-2"><div class="card"><h2>Roster</h2><table><tr><th>Agent</th><th>Does</th><th>Invoke</th></tr>${agents.map(([n, d, c]) => `<tr><td class="mono">${n}</td><td class="muted">${esc(d)}</td><td class="mono" style="color:var(--accent)">${esc(c)}</td></tr>`).join("")}</table></div>
  <div class="card"><h2>Recent runs</h2>${runs.length ? `<table><tr><th>Agent</th><th>Objective</th><th>Status</th><th>Summary</th></tr>${runs.map((r) => `<tr><td class="mono">${esc(r.agent)}</td><td>${esc(r.objective)}</td><td>${pill(r.status)}</td><td class="muted">${esc(r.summary ?? "")}</td></tr>`).join("")}</table>` : `<div class="empty">No runs logged yet. Agents log runs with <code>jarvis agent start …</code></div>`}</div></div>`;
}

// ---------------------------------------------------------------- unit
async function viewUnit(ref, tab) {
  const d = await api("unit/" + encodeURIComponent(ref));
  const u = d.unit, bp = d.blueprint;
  const [cslug] = ref.split("/");
  const tabs = [["next", "Next", d.next.actions.length], ["tasks", "Tasks", d.tasks.length]];
  if (bp.kind === "validation") tabs.push(["validation", "Validation", d.gate ? `${d.gate.met}/${d.gate.total}` : ""]);
  else tabs.push(["kpis", "KPIs", d.metrics.length]);
  tabs.push(["pipeline", "Pipeline", d.leads.length], ["decisions", "Decisions", d.decisions.length], ["notes", "Notes", d.notes.length], ["approvals", "Approvals", d.approvals.length]);
  const base = `#/unit/${cslug}/${u.slug}`;
  let body = "";
  if (tab === "next") body = tabNext(d);
  else if (tab === "tasks") body = tabTasks(d, ref);
  else if (tab === "validation") body = tabValidation(d, ref);
  else if (tab === "kpis") body = tabKpis(d, ref);
  else if (tab === "pipeline") body = tabPipeline(d, ref);
  else if (tab === "decisions") body = tabDecisions(d, ref);
  else if (tab === "notes") body = tabNotes(d, ref);
  else if (tab === "approvals") body = d.approvals.length ? `<p class="muted">${d.approvals.length} pending. Decide in the <a href="#/approvals">Approvals inbox</a>.</p>` : `<div class="empty">No pending approvals for this unit.</div>`;
  return `
  <div class="topbar"><div><div class="crumbs"><a href="#/company/${cslug}">${esc(cslug)}</a> / <b>${esc(u.slug)}</b></div><h1>${esc(u.name)} <span class="pill ${esc(u.status)}">${esc(u.status)}</span></h1><div class="mission">${esc(u.mission ?? "")}</div></div>
    <div class="row-actions">${u.status === "active" ? `<button class="ghost" onclick="unitStatus('${u.id}','parked')">Park</button>` : `<button class="primary" onclick="unitStatus('${u.id}','active')">Activate</button>`}</div></div>
  ${bp.stages ? `<div class="stages">${bp.stages.map((s, i) => { const ci = bp.stages.findIndex((x) => x.key === u.stage); return `<span class="${i < ci ? "done" : i === ci ? "current" : ""}">${esc(s.name)}</span>`; }).join("")}</div>` : ""}
  ${warnings(d.next.warnings)}
  <div class="tabs">${tabs.map(([k, l, n]) => `<a href="${base}/${k}" class="${tab === k ? "active" : ""}">${l}<span class="n">${n}</span></a>`).join("")}</div>
  ${body}`;
}
window.unitStatus = (id, status) => act(`units/${id}/status`, { status }, `Unit ${status}`);

function tabNext(d) {
  return `<div class="grid cols-2"><div class="card"><h2>Next actions</h2>${actionList(d.next.actions)}</div>
    <div class="card"><h2>Initiatives <span class="dim mono" style="font-size:11px">max 3</span></h2>
      ${d.initiatives.length ? `<table>${d.initiatives.map((i) => `<tr><td><b>${esc(i.title)}</b><div class="muted" style="font-size:12px">${esc(i.objective ?? "")}</div></td><td class="mono dim">${fmtDate(i.due)}</td><td class="right"><button class="small" onclick="act('initiatives/${i.id}/close',{status:'done'},'Initiative closed')">Done</button></td></tr>`).join("")}</table>` : `<div class="empty">No active initiative. Define the one thing that moves this unit this month.</div>`}
      <details><summary>+ Add initiative</summary><form class="form" onsubmit="submitForm(event,'initiatives','Initiative added')"><input type="hidden" name="unit" value="${d.unit.id}"><div><label>Title</label><input name="title" required></div><div><label>Measurable objective</label><input name="objective" placeholder="e.g. 10 stockists signed by 31 Oct"></div><div class="row"><div><label>Due</label><input name="due" type="date"></div><div><label>Priority</label><select name="priority"><option value="1">1 high</option><option value="2" selected>2</option><option value="3">3 low</option></select></div></div><div><button class="primary">Add</button></div></form></details>
    </div></div>
    ${d.experiments.length ? `<div class="card" style="margin-top:16px"><h3>Experiments</h3>${experimentsTable(d.experiments)}</div>` : ""}`;
}
window.act = act;

function tabTasks(d, ref) {
  return `<div class="card"><h2>Open tasks</h2>
    ${d.tasks.length ? `<table><tr><th>P</th><th>Task</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr>${d.tasks.map((t) => `<tr><td class="mono">${t.priority}</td><td>${esc(t.title)}${t.notes ? `<div class="muted" style="font-size:12px">${esc(t.notes)}</div>` : ""}</td><td class="mono dim">${esc(t.owner)}</td><td class="mono dim">${fmtDate(t.due)}</td><td>${pill(t.status)}</td><td class="right"><div class="row-actions">${t.status !== "doing" ? `<button class="small" onclick="act('tasks/${t.id}/status',{status:'doing'},'Started')">Start</button>` : ""}<button class="small primary" onclick="act('tasks/${t.id}/status',{status:'done'},'Done')">Done</button><button class="small ghost" onclick="act('tasks/${t.id}/status',{status:'dropped'},'Dropped')">Drop</button></div></td></tr>`).join("")}</table>` : `<div class="empty">No open tasks.</div>`}
    <form class="form" onsubmit="submitForm(event,'tasks','Task added')"><input type="hidden" name="unit" value="${d.unit.id}"><div class="row" style="grid-template-columns:3fr 1fr 1fr 1fr auto"><div><label>New task</label><input name="title" required placeholder="What needs to happen"></div><div><label>Owner</label><input name="owner" placeholder="founder"></div><div><label>Due</label><input name="due" type="date"></div><div><label>P</label><select name="priority"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select></div><div style="align-self:end"><button class="primary">Add</button></div></div></form></div>`;
}

function tabValidation(d, ref) {
  const bp = d.blueprint, u = d.unit;
  const st = bp.stages.find((s) => s.key === u.stage);
  const ev = d.gate_evidence.filter((e) => e.stage === u.stage);
  return `<div class="grid cols-2">
    <div class="card"><h2>${esc(st.name)} <span class="dim mono" style="font-size:11px">gate ${d.gate.met}/${d.gate.total}</span></h2><p class="muted">${esc(st.purpose)}</p>
      <ul class="criteria">${st.criteria.map((c) => { const e = ev.find((x) => x.criterion === c.key); const met = e && e.status !== "open"; return `<li><input type="checkbox" ${met ? "checked" : ""} onchange="gate('${u.id}','${c.key}',this.checked)"><div><div>${esc(c.label)} ${c.target ? `<span class="dim mono">target ${c.target}</span>` : ""}</div><div class="key">${c.key}${e?.status === "waived" ? " · waived" : ""}</div>${e?.evidence ? `<div class="ev">${esc(e.evidence)}</div>` : ""}</div></li>`; }).join("")}</ul>
      <div class="row-actions" style="margin-top:12px"><button class="${d.gate.complete ? "primary" : ""}" onclick="advance('${u.id}',${d.gate.complete})">${d.gate.complete ? "Advance to next stage" : "Gate not complete"}</button></div>
      <h4 style="margin-top:16px">Expected outputs</h4><ul class="muted" style="padding-left:18px;font-size:12.5px">${st.outputs.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
      ${bp.kill_rules ? `<h4 style="margin-top:12px">Kill rules</h4><ul class="muted" style="padding-left:18px;font-size:12.5px">${bp.kill_rules.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="card"><h2>Experiments</h2>${d.experiments.length ? experimentsTable(d.experiments) : `<div class="empty">No experiments yet. Every open criterion should have one generating evidence.</div>`}
      <form class="form" onsubmit="submitForm(event,'experiments','Experiment added')"><input type="hidden" name="unit" value="${u.id}"><div><label>Hypothesis</label><input name="hypothesis" required placeholder="We believe … will … measured by …"></div><div class="row"><div><label>Method</label><select name="method"><option>landing_page</option><option>waitlist</option><option>preorder</option><option>interviews</option><option>outreach_test</option><option>pricing_test</option><option>pilot</option><option>retailer_test</option><option>other</option></select></div><div><label>Metric</label><input name="metric" placeholder="qualified signups"></div><div><label>Target</label><input name="target" placeholder="100 in 3 weeks"></div></div><div><button class="primary">Add</button></div></form>
    </div></div>`;
}
window.gate = async (unit, criterion, checked) => {
  const evidence = checked ? prompt("Evidence (what proves it? link or one line)") : null;
  if (checked && evidence === null) return render();
  await act("gate", { unit, criterion, status: checked ? "met" : "open", evidence }, "Gate updated");
};
window.advance = async (unit, complete) => {
  if (!complete && !confirm("Gate is not complete. Force-advance? This is logged.")) return;
  await act("advance", { unit, force: complete ? "false" : "true" }, "Stage advanced");
};
function experimentsTable(exps) {
  return `<table><tr><th>Hypothesis</th><th>Method</th><th>Target</th><th>Status</th><th></th></tr>${exps.map((e) => `<tr><td>${esc(e.hypothesis)}${e.result ? `<div class="muted" style="font-size:12px">result: ${esc(e.result)}</div>` : ""}${e.learning ? `<div class="muted" style="font-size:12px">learning: ${esc(e.learning)}</div>` : ""}</td><td class="mono dim">${esc(e.method ?? "")}</td><td class="mono dim">${esc(e.target ?? "")}</td><td>${pill(e.status)}</td><td class="right"><div class="row-actions">${e.status === "planned" ? `<button class="small" onclick="act('experiments/${e.id}',{status:'running'},'Running')">Start</button>` : ""}${e.status === "running" ? `<button class="small primary" onclick="expResult('${e.id}','passed')">Passed</button><button class="small danger" onclick="expResult('${e.id}','failed')">Failed</button>` : ""}</div></td></tr>`).join("")}</table>`;
}
window.expResult = async (id, status) => {
  const result = prompt("Result (numbers)"); if (result === null) return;
  const learning = prompt("Learning (one line)") ?? "";
  await act(`experiments/${id}`, { status, result, learning }, `Experiment ${status}`);
};

function tabKpis(d, ref) {
  const bp = d.blueprint;
  const period = new Date().toISOString().slice(0, 7);
  return `<div class="grid cols-2"><div class="card"><h2>KPIs</h2>
    <div class="kpis">${(bp.kpis ?? []).map((k) => { const m = d.metrics.find((x) => x.key === k.key); const off = m && k.target !== undefined && (k.direction === "up" ? m.value < k.target : m.value > k.target); const ok = m && k.target !== undefined && !off; return `<div class="kpi ${off ? "off" : ok ? "ok" : ""}"><div class="v">${m ? m.value : "—"}</div><div class="l">${esc(k.label)}${k.target !== undefined ? ` · target ${k.target}` : ""}${m ? ` · ${esc(m.period)}` : ""}</div></div>`; }).join("")}</div>
    <form class="form" onsubmit="submitForm(event,'metrics','Metric recorded')"><input type="hidden" name="unit" value="${d.unit.id}"><div class="row"><div><label>KPI</label><select name="key">${(bp.kpis ?? []).map((k) => `<option value="${k.key}">${esc(k.label)}</option>`).join("")}</select></div><div><label>Value</label><input name="value" type="number" step="any" required></div><div><label>Period</label><input name="period" value="${period}"></div><div style="align-self:end"><button class="primary">Record</button></div></div></form></div>
    <div class="card"><h2>Operating rhythm</h2><table>${(bp.cadence ?? []).map((c) => `<tr><td>${esc(c.label)}</td><td class="mono dim">${esc(c.every)}</td></tr>`).join("")}</table>
      <h4 style="margin-top:14px">Health checks</h4><ul class="muted" style="padding-left:18px;font-size:12.5px">${(bp.health_checks ?? []).map((h) => `<li>${esc(h.label)}</li>`).join("")}</ul></div></div>`;
}

function tabPipeline(d, ref) {
  const ps = d.pipeline ?? {};
  const drafts = d.outreach.filter((o) => o.status === "draft" && !o.approval_id).length;
  const approved = d.outreach.filter((o) => o.status === "approved");
  return `<div class="kpis" style="margin-bottom:14px">${["new", "researched", "queued", "contacted", "replied", "meeting", "proposal", "won"].map((k) => `<div class="kpi"><div class="v">${ps[k] ?? 0}</div><div class="l">${k}</div></div>`).join("")}</div>
  ${approved.length ? `<div class="warnings"><div>${approved.length} approved email(s) ready. Send via Gmail (Claude: <code>/send-approved ${esc(ref)}</code>) then mark sent below.</div></div>` : ""}
  <div class="card"><h2>Leads <span>${drafts ? `<button class="primary small" onclick="act('outreach/batch',{unit:'${d.unit.id}'},'Batch approval requested')">Bundle ${drafts} drafts into approval</button>` : ""}</span></h2>
    ${d.leads.length ? `<table><tr><th>Fit</th><th>Company</th><th>Contact</th><th>Segment</th><th>Status</th><th>Angle</th><th>Next</th><th></th></tr>${d.leads.map((l) => `<tr><td class="mono">${l.fit_score ?? "—"}</td><td><b>${esc(l.company_name)}</b>${l.website ? `<div class="dim" style="font-size:11px">${esc(l.website)}</div>` : ""}</td><td style="font-size:12.5px">${esc(l.contact_name ?? "")}<div class="dim" style="font-size:11px">${esc(l.contact_role ?? "")}${l.contact_email ? " · " + esc(l.contact_email) : ""}</div></td><td class="mono dim">${esc(l.segment ?? "")}</td><td><select class="small" onchange="act('leads/${l.id}',{status:this.value},'Lead updated')" style="width:auto;padding:2px 6px;font-size:12px">${["new", "researched", "queued", "contacted", "replied", "meeting", "proposal", "won", "lost", "disqualified"].map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></td><td class="muted" style="font-size:12px;max-width:260px">${esc(l.angle ?? "")}</td><td class="mono dim">${fmtDate(l.next_action_at)}</td><td><details><summary>✉</summary>${leadOutreach(d, l)}</details></td></tr>`).join("")}</table>` : `<div class="empty">No leads. Run <code>/research-leads ${esc(ref)} &lt;segment&gt; 10</code> in Claude or add one below.</div>`}
    <details><summary>+ Add lead</summary><form class="form" onsubmit="submitForm(event,'leads','Lead added')"><input type="hidden" name="unit" value="${d.unit.id}"><div class="row"><div><label>Company</label><input name="company_name" required></div><div><label>Segment</label><input name="segment" placeholder="fmcg / tech / travel / agency"></div><div><label>Country</label><input name="country"></div><div><label>Website</label><input name="website"></div><div><label>Fit 0-100</label><input name="fit_score" type="number" min="0" max="100"></div></div><div class="row"><div><label>Contact</label><input name="contact_name"></div><div><label>Role</label><input name="contact_role"></div><div><label>Email</label><input name="contact_email" type="email"></div></div><div><label>Angle</label><input name="angle" placeholder="Why now for them"></div><div><button class="primary">Add</button></div></form></details>
  </div>`;
}
function leadOutreach(d, l) {
  const msgs = d.outreach.filter((o) => o.lead_id === l.id);
  return `<div style="min-width:420px">${msgs.map((o) => `<div style="margin:8px 0"><div class="mono dim" style="font-size:11px">step ${o.sequence_step} · ${pill(o.status)} · ${fmtDate(o.created_at)} · by ${esc(o.created_by)}</div><b>${esc(o.subject ?? "")}</b><pre class="body">${esc(o.body)}</pre><div class="row-actions">${o.status === "approved" ? `<button class="small primary" onclick="act('outreach/${o.id}/sent',{},'Marked sent')">Mark sent</button>` : ""}${o.status === "sent" ? `<button class="small" onclick="act('outreach/${o.id}/replied',{},'Marked replied')">Replied</button>` : ""}</div></div>`).join("") || `<div class="empty">No outreach yet.</div>`}
    <form class="form" onsubmit="submitForm(event,'outreach','Draft saved')"><input type="hidden" name="lead_id" value="${l.id}"><div><label>Subject</label><input name="subject"></div><div><label>Body</label><textarea name="body" required></textarea></div><div class="row"><div><label>Step</label><input name="sequence_step" type="number" value="${msgs.length + 1}"></div><div style="align-self:end"><button class="primary">Save draft</button></div></div></form></div>`;
}

function tabDecisions(d, ref) {
  return `<div class="card"><h2>Open decisions</h2>
    ${d.decisions.length ? d.decisions.map((x) => { const opts = JSON.parse(x.options || "[]"); return `<div class="form" style="border-style:solid"><b>${esc(x.title)}</b>${x.context ? `<div class="muted" style="font-size:12.5px">${esc(x.context)}</div>` : ""}<div class="row-actions">${opts.map((o) => `<button class="small" onclick="decide('${x.id}',${JSON.stringify(o).replace(/"/g, "&quot;")})">${esc(o)}</button>`).join("")}<button class="small ghost" onclick="decide('${x.id}',null)">Other…</button></div></div>`; }).join("") : `<div class="empty">No open decisions.</div>`}
    <details><summary>+ Log a decision to make</summary><form class="form" onsubmit="submitForm(event,'decisions','Decision logged')"><input type="hidden" name="unit" value="${d.unit.id}"><div><label>Question</label><input name="title" required></div><div><label>Context</label><input name="context"></div><div><label>Options (a | b | c)</label><input name="options"></div><div><button class="primary">Add</button></div></form></details></div>`;
}
window.decide = async (id, choice) => {
  const decision = choice ?? prompt("Decision"); if (!decision) return;
  const rationale = prompt("Rationale (one line)") ?? "";
  await act(`decisions/${id}/decide`, { decision, rationale }, "Decided");
};

function tabNotes(d, ref) {
  return `<div class="card"><h2>Notes, research, feedback</h2>
    ${d.notes.length ? d.notes.map((n) => `<details><summary><span class="pill ${esc(n.kind)}">${esc(n.kind)}</span> <b>${esc(n.title)}</b> <span class="dim mono" style="font-size:11px">${fmtDate(n.created_at)} · ${esc(n.author)}</span></summary><pre class="body">${esc(n.body)}</pre></details>`).join("") : `<div class="empty">Nothing yet. Agents store research, memos and feedback here.</div>`}
    <details><summary>+ Add note</summary><form class="form" onsubmit="submitForm(event,'notes','Note saved')"><input type="hidden" name="unit" value="${d.unit.id}"><div class="row"><div><label>Title</label><input name="title" required></div><div><label>Kind</label><select name="kind"><option>note</option><option>research</option><option>feedback</option><option>memo</option></select></div></div><div><label>Body</label><textarea name="body" required></textarea></div><div><button class="primary">Save</button></div></form></details></div>`;
}

render();
