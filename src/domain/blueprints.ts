import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Blueprint, Stage } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "../../blueprints");

let cache: Map<string, Blueprint> | null = null;

export function blueprints(): Map<string, Blueprint> {
  if (cache) return cache;
  cache = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const bp = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Blueprint;
    cache.set(bp.key, bp);
  }
  return cache;
}

export function blueprint(key: string): Blueprint {
  const bp = blueprints().get(key);
  if (!bp) throw new Error(`Unknown blueprint: ${key}. Known: ${[...blueprints().keys()].join(", ")}`);
  return bp;
}

export function stageOf(bp: Blueprint, key: string | null): Stage | undefined {
  return bp.stages?.find((s) => s.key === key);
}

export function nextStage(bp: Blueprint, key: string | null): Stage | undefined {
  if (!bp.stages) return undefined;
  const i = bp.stages.findIndex((s) => s.key === key);
  return bp.stages[i + 1];
}

export function firstStage(bp: Blueprint): Stage | undefined {
  return bp.stages?.[0];
}
