import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

export type Row = Record<string, unknown>;

const here = dirname(fileURLToPath(import.meta.url));

export function dbPath(): string {
  return resolve(process.cwd(), process.env.JARVIS_DB ?? "./data/jarvis.db");
}

let _db: DatabaseSync | null = null;

/** Open (and migrate) the database. Pass ":memory:" for tests. */
export function openDb(path: string = dbPath()): DatabaseSync {
  if (_db) return _db;
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve(here, "schema.sql"), "utf8"));
  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function db(): DatabaseSync {
  return _db ?? openDb();
}

// --- helpers -------------------------------------------------------------

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Sortable id: 10 chars of time (ms, base32) + 8 random chars. */
export function newId(): string {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rnd = randomBytes(8);
  let r = "";
  for (let i = 0; i < 8; i++) r += ALPHABET[rnd[i] % 32];
  return time + r;
}

export function now(): string {
  return new Date().toISOString();
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[];
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): { changes: number | bigint } {
  return db().prepare(sql).run(...(params as never[]));
}

export function insert(table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
  run(sql, ...keys.map((k) => normalize(row[k])));
}

export function update(table: string, id: string, patch: Record<string, unknown>): void {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (keys.length === 0) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  run(sql, ...keys.map((k) => normalize(patch[k])), id);
}

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

export function logEvent(actor: string, type: string, opts: { unit_id?: string | null; ref_id?: string | null; payload?: unknown } = {}): void {
  insert("events", {
    id: newId(),
    ts: now(),
    actor,
    unit_id: opts.unit_id ?? null,
    type,
    ref_id: opts.ref_id ?? null,
    payload: JSON.stringify(opts.payload ?? {}),
  });
}

/** Resolve a row by full id or by unique suffix (the last 6+ chars shown in the CLI/dashboard). */
export function byRef<T = Row>(table: string, ref: string): T | undefined {
  const exact = get<T>(`SELECT * FROM ${table} WHERE id = ?`, ref);
  if (exact) return exact;
  const rows = all<T & { id: string }>(`SELECT * FROM ${table} WHERE id LIKE ?`, "%" + ref);
  if (rows.length > 1) throw new Error(`Ambiguous ref ${ref} in ${table}: ${rows.map((r) => r.id).join(", ")}`);
  return rows[0];
}

export function short(id: string): string {
  return id.slice(-6);
}

export function actor(): string {
  return process.env.JARVIS_ACTOR ?? process.env.JARVIS_FOUNDER ?? "founder";
}
