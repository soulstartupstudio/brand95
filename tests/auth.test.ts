import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { openDb, closeDb } from "../src/db/index.ts";
import { seed } from "../src/seed.ts";
import { serve } from "../src/server/index.ts";

let server: Server;
let base: string;

before(async () => {
  openDb(":memory:"); seed();
  process.env.JARVIS_PASSWORD = "correct horse";
  server = serve(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
after(async () => { delete process.env.JARVIS_PASSWORD; server.close(); closeDb(); });

const f = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: "manual", ...init });

test("unauthenticated: dashboard redirects to /login, API returns 401", async () => {
  const r1 = await f("/");
  assert.equal(r1.status, 302);
  assert.equal(r1.headers.get("location"), "/login");
  const r2 = await f("/api/status");
  assert.equal(r2.status, 401);
  const r3 = await f("/login");
  assert.equal(r3.status, 200);
  assert.match(await r3.text(), /Password/);
});

test("wrong password → 401 with message; right password → cookie; cookie grants access; logout clears", async () => {
  const bad = await f("/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=nope" });
  assert.equal(bad.status, 401);
  assert.match(await bad.text(), /Wrong password/);
  const ok = await f("/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=" + encodeURIComponent("correct horse") });
  assert.equal(ok.status, 303);
  const cookie = ok.headers.get("set-cookie")!;
  assert.match(cookie, /jarvis_session=[0-9a-f]{64}; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/); // plain http in tests
  const c = cookie.split(";")[0];
  const st = await f("/api/status", { headers: { cookie: c } });
  assert.equal(st.status, 200);
  assert.equal(((await st.json()) as { auth: boolean }).auth, true);
  const page = await f("/", { headers: { cookie: c } });
  assert.equal(page.status, 200);
  const out = await f("/logout", { headers: { cookie: c } });
  assert.equal(out.status, 303);
  assert.match(out.headers.get("set-cookie")!, /Max-Age=0/);
});

test("secure flag follows x-forwarded-proto https", async () => {
  const ok = await f("/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" }, body: "password=" + encodeURIComponent("correct horse") });
  assert.match(ok.headers.get("set-cookie")!, /; Secure/);
});

test("bearer token works for the API; forged cookie does not", async () => {
  const r = await f("/api/cockpit", { headers: { authorization: "Bearer correct horse" } });
  assert.equal(r.status, 200);
  const forged = await f("/api/cockpit", { headers: { cookie: "jarvis_session=" + "a".repeat(64) } });
  assert.equal(forged.status, 401);
});

test("rate limit: sixth wrong attempt from one IP is locked out", async () => {
  const ip = { "x-forwarded-for": "203.0.113.9", "content-type": "application/x-www-form-urlencoded" };
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await f("/login", { method: "POST", headers: ip, body: "password=x" })).status;
  assert.equal(last, 429);
});

test("refuses public bind without a password", () => {
  const saved = process.env.JARVIS_PASSWORD; delete process.env.JARVIS_PASSWORD;
  assert.throws(() => serve(0, "0.0.0.0"), /Refusing to bind/);
  process.env.JARVIS_PASSWORD = saved;
});
