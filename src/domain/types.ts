export type CompanyKind = "agency" | "studio" | "venture_builder" | "saas" | "entity";
export type UnitKind = "department" | "venture" | "brand" | "concept";
export type UnitStatus = "active" | "parked" | "killed" | "graduated";
export type TaskStatus = "open" | "doing" | "blocked" | "done" | "dropped";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested" | "executed" | "expired";
export type LeadStatus =
  | "new" | "researched" | "queued" | "contacted" | "replied" | "meeting" | "proposal" | "won" | "lost" | "disqualified";
export type OutreachStatus = "draft" | "approved" | "sent" | "replied" | "bounced" | "cancelled";

export interface Company {
  id: string; slug: string; name: string; kind: CompanyKind; north_star: string | null;
  status: string; sort: number; created_at: string;
}

export interface Unit {
  id: string; company_id: string; slug: string; name: string; kind: UnitKind; blueprint: string;
  stage: string | null; owner: string; status: UnitStatus; mission: string | null; meta: string; sort: number; created_at: string;
}

export interface Task {
  id: string; unit_id: string; initiative_id: string | null; title: string; notes: string | null;
  status: TaskStatus; priority: number; owner: string; due: string | null; created_at: string; done_at: string | null;
}

export interface Initiative {
  id: string; unit_id: string; title: string; objective: string | null; status: string; priority: number;
  owner: string; due: string | null; created_at: string; done_at: string | null;
}

export interface Approval {
  id: string; unit_id: string | null; kind: string; title: string; proposal: string; why_now: string | null;
  evidence: string | null; exposure: string | null; alternatives: string | null; recommendation: string | null;
  risk_level: number; payload: string; status: ApprovalStatus; requested_by: string; note: string | null;
  created_at: string; decided_at: string | null; executed_at: string | null;
}

export interface Lead {
  id: string; unit_id: string; company_name: string; segment: string | null; website: string | null; country: string | null;
  contact_name: string | null; contact_role: string | null; contact_email: string | null; linkedin: string | null;
  fit_score: number | null; status: LeadStatus; research: string | null; angle: string | null; source: string | null;
  next_action_at: string | null; created_at: string; updated_at: string;
}

export interface Outreach {
  id: string; unit_id: string; lead_id: string; approval_id: string | null; channel: string; sequence_step: number;
  to_email: string | null; subject: string | null; body: string; status: OutreachStatus; external_id: string | null;
  created_by: string; created_at: string; sent_at: string | null;
}

export interface Experiment {
  id: string; unit_id: string; stage: string | null; hypothesis: string; method: string | null; metric: string | null;
  target: string | null; result: string | null; learning: string | null; status: string; created_at: string;
  started_at: string | null; ended_at: string | null;
}

export interface Decision {
  id: string; unit_id: string | null; title: string; context: string | null; options: string; decision: string | null;
  rationale: string | null; status: string; created_at: string; decided_at: string | null;
}

export interface GateEvidence {
  id: string; unit_id: string; stage: string; criterion: string; status: "open" | "met" | "waived"; evidence: string | null; updated_at: string;
}

export interface Metric { id: string; unit_id: string; key: string; value: number; period: string; note: string | null; recorded_at: string; }
export interface Note { id: string; unit_id: string | null; kind: string; title: string; body: string; author: string; created_at: string; }
export interface AgentRun { id: string; agent: string; unit_id: string | null; objective: string; status: string; summary: string | null; outputs: string; started_at: string; finished_at: string | null; }
export interface Event { id: string; ts: string; actor: string; unit_id: string | null; type: string; ref_id: string | null; payload: string; }

// --- blueprints ----------------------------------------------------------

export interface Criterion { key: string; label: string; target?: number; }
export interface Stage { key: string; name: string; purpose: string; outputs: string[]; criteria: Criterion[]; }
export interface Kpi { key: string; label: string; direction: "up" | "down"; target?: number; }
export interface Cadence { key: string; label: string; every: "week" | "month" | "quarter"; }
export interface HealthCheck { key: string; label: string; }

export interface Blueprint {
  key: string;
  name: string;
  kind: "department" | "validation";
  mission: string;
  stages?: Stage[];
  kpis?: Kpi[];
  cadence?: Cadence[];
  health_checks?: HealthCheck[];
  playbooks?: string[];
  kill_rules?: string[];
  portfolio_rule?: string;
}
