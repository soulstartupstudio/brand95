import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb, closeDb } from "../src/db/index.ts";
import { seed } from "../src/seed.ts";
import { chat, modelConfig, sessionHistory, clearSession } from "../src/server/chat.ts";

before(() => { openDb(":memory:"); seed(); });
after(() => closeDb());

test("model config: defaults to opus 5, low effort; deep raises effort; fast only on supported models", () => {
  delete process.env.JARVIS_MODEL; delete process.env.JARVIS_FAST; delete process.env.JARVIS_EFFORT;
  assert.equal(modelConfig(false).model, "claude-opus-5");
  assert.equal(modelConfig(false).effort, "low");
  assert.equal(modelConfig(true).effort, "high");
  process.env.JARVIS_FAST = "1";
  assert.equal(modelConfig().fast, true);
  process.env.JARVIS_MODEL = "claude-haiku-4-5";
  assert.equal(modelConfig().fast, false);
  assert.equal(modelConfig().supportsEffort, false);
  delete process.env.JARVIS_MODEL; delete process.env.JARVIS_FAST;
});

test("chat without credentials yields an error event, never throws, and does not corrupt history", async () => {
  const saved = { key: process.env.ANTHROPIC_API_KEY, tok: process.env.ANTHROPIC_AUTH_TOKEN };
  delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:1"; // unreachable: fail fast instead of hitting the network
  const events: string[] = [];
  for await (const ev of chat("hello", { session: "t1" })) events.push(ev.type);
  assert.ok(events.includes("error"), events.join(","));
  const h = sessionHistory("t1");
  assert.ok(h.length >= 1 && h[0].role === "user");
  clearSession("t1");
  assert.equal(sessionHistory("t1").length, 0);
  if (saved.key) process.env.ANTHROPIC_API_KEY = saved.key;
  if (saved.tok) process.env.ANTHROPIC_AUTH_TOKEN = saved.tok;
  delete process.env.ANTHROPIC_BASE_URL;
});
