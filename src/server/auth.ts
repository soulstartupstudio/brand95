/**
 * Password gate for hosted deployments. Enabled when JARVIS_PASSWORD is set.
 * One founder, one password: a stateless signed session cookie, plus `Authorization: Bearer <password>` for scripts.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE = "jarvis_session";
const MAX_AGE = 30 * 86400; // seconds
const attempts = new Map<string, { n: number; until: number }>();

export function authEnabled(): boolean {
  return !!process.env.JARVIS_PASSWORD;
}

function password(): string {
  return process.env.JARVIS_PASSWORD ?? "";
}

function secret(): string {
  return process.env.JARVIS_SESSION_SECRET ?? createHash("sha256").update("jarvis:" + password()).digest("hex");
}

function sessionToken(): string {
  return createHmac("sha256", secret()).update("session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function isAuthorized(req: IncomingMessage): boolean {
  if (!authEnabled()) return true;
  const c = cookies(req)[COOKIE];
  if (c && safeEqual(c, sessionToken())) return true;
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ") && safeEqual(auth.slice(7).trim(), password())) return true;
  return false;
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return (first ?? req.socket.remoteAddress ?? "?").trim();
}

function isSecure(req: IncomingMessage): boolean {
  if (process.env.JARVIS_SECURE_COOKIE === "0") return false;
  const proto = req.headers["x-forwarded-proto"];
  return process.env.JARVIS_SECURE_COOKIE === "1" || (typeof proto === "string" && proto.split(",")[0].trim() === "https");
}

/** Returns true when the request was fully handled (login/logout pages or a rejection). */
export async function gate(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!authEnabled()) return false;
  if (pathname === "/logout") {
    res.writeHead(303, { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`, location: "/login" });
    res.end();
    return true;
  }
  if (pathname === "/login") {
    if (req.method === "POST") {
      const ip = clientIp(req);
      const a = attempts.get(ip);
      if (a && a.n >= 5 && Date.now() < a.until) {
        res.writeHead(429, { "content-type": "text/html; charset=utf-8", "retry-after": "60" });
        res.end(loginPage("Too many attempts. Wait a minute."));
        return true;
      }
      const body = await readForm(req);
      if (body.password && safeEqual(body.password, password())) {
        attempts.delete(ip);
        const secure = isSecure(req) ? "; Secure" : "";
        res.writeHead(303, { "set-cookie": `${COOKIE}=${sessionToken()}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`, location: "/" });
        res.end();
        return true;
      }
      const next = a && Date.now() < a.until ? { n: a.n + 1, until: a.until } : { n: 1, until: Date.now() + 60_000 };
      attempts.set(ip, next);
      res.writeHead(401, { "content-type": "text/html; charset=utf-8" });
      res.end(loginPage("Wrong password."));
      return true;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(loginPage());
    return true;
  }
  if (isAuthorized(req)) return false;
  if (pathname.startsWith("/api/")) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized. Sign in at /login or send Authorization: Bearer <password>." }));
    return true;
  }
  res.writeHead(302, { location: "/login" });
  res.end();
  return true;
}

function readForm(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on("end", () => {
      try {
        if ((req.headers["content-type"] ?? "").includes("application/json")) resolve(JSON.parse(data || "{}"));
        else resolve(Object.fromEntries(new URLSearchParams(data)));
      } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function loginPage(error?: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>JARVIS · Sign in</title>
<style>
  html,body{margin:0;height:100%;background:#070b12;color:#e2e8f0;font:14px/1.45 -apple-system,"Inter","Segoe UI",system-ui,sans-serif}
  main{min-height:100%;display:grid;place-items:center;padding:24px 16px;box-sizing:border-box}
  form{width:min(360px,100%);background:#0f172a;border:1px solid #1e2a44;border-radius:12px;padding:26px 24px;display:grid;gap:14px}
  .logo{display:flex;align-items:center;gap:10px}.orb{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#a5f3fc,#22d3ee 45%,#0369a1 90%);box-shadow:0 0 18px rgba(34,211,238,.55)}
  b{font-family:ui-monospace,Menlo,monospace;letter-spacing:.18em}small{display:block;color:#55627a;font-size:10px;letter-spacing:.1em}
  label{font-size:11px;color:#55627a;text-transform:uppercase;letter-spacing:.06em}
  input{width:100%;box-sizing:border-box;background:#0c1220;border:1px solid #2a3a5c;border-radius:6px;padding:10px 12px;color:inherit;font:inherit}
  input:focus{outline:none;border-color:#22d3ee}
  button{background:#22d3ee;color:#041016;border:0;border-radius:6px;padding:10px 12px;font-weight:700;font:inherit;cursor:pointer}
  .err{color:#f87171;font-size:13px}
</style></head><body><main>
<form method="post" action="/login"><div class="logo"><div class="orb"></div><div><b>JARVIS</b><small>FOUNDER COMMAND CENTER</small></div></div>
<div><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" autofocus required></div>
${error ? `<div class="err">${error}</div>` : ""}
<button type="submit">Sign in</button></form></main></body></html>`;
}
