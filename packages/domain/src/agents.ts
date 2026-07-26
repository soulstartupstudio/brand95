/**
 * Registry of Brand95 specialist agents (spec §3). Runtime prompts live in
 * .codex/agents/*.toml; this registry is what the database and UI reference.
 */

export const AGENT_KEYS = [
  "ceo_orchestrator",
  "research",
  "brand_builder",
  "product",
  "creative_studio",
  "growth",
  "retail",
  "operations",
  "finance",
  "customer_support",
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export interface AgentDef {
  key: AgentKey;
  name: string;
  mission: string;
  primaryKpi: string;
}

export const AGENTS: Record<AgentKey, AgentDef> = {
  ceo_orchestrator: {
    key: "ceo_orchestrator",
    name: "CEO Orchestrator",
    mission:
      "Identify the biggest constraint, route work, enforce gates, and present decisions to the founder.",
    primaryKpi: "Time from idea to validated commercial decision",
  },
  research: {
    key: "research",
    name: "Research",
    mission: "Produce source-backed opportunity and validation research.",
    primaryKpi: "Decisions supported by credible evidence",
  },
  brand_builder: {
    key: "brand_builder",
    name: "Brand Builder",
    mission: "Turn a validated opportunity into a distinctive brand system.",
    primaryKpi: "Speed to approved, usable brand system",
  },
  product: {
    key: "product",
    name: "Product",
    mission:
      "Take the hero product from requirements through production readiness.",
    primaryKpi: "Approved product delivered on time, on spec, and within target cost",
  },
  creative_studio: {
    key: "creative_studio",
    name: "Creative Studio",
    mission: "Produce and manage creative requirements and first-draft assets.",
    primaryKpi: "Percentage of required launch assets approved and available",
  },
  growth: {
    key: "growth",
    name: "Growth",
    mission: "Acquire and retain customers profitably.",
    primaryKpi: "Incremental contribution margin and validated channel learnings",
  },
  retail: {
    key: "retail",
    name: "Retail",
    mission: "Win, support, and retain high-fit stockists.",
    primaryKpi: "Active stockists, reorder rate, and wholesale contribution margin",
  },
  operations: {
    key: "operations",
    name: "Operations",
    mission: "Make delivery reliable and repeatable.",
    primaryKpi: "On-time, in-full delivery and low exception rate",
  },
  finance: {
    key: "finance",
    name: "Finance Analyst",
    mission: "Protect cash and make commercial economics visible.",
    primaryKpi: "Forecast accuracy and cash-risk visibility",
  },
  customer_support: {
    key: "customer_support",
    name: "Customer Support",
    mission:
      "Resolve customer questions consistently while surfacing product insight.",
    primaryKpi: "Resolution time, satisfaction, and actionable insight captured",
  },
};
