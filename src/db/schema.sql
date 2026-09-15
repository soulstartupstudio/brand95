-- Jarvis Command Center schema. SQLite. All ids are text (ulid-like), timestamps ISO-8601 UTC.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                -- agency | studio | venture_builder | saas | entity
  north_star TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                -- department | venture | brand | concept
  blueprint TEXT NOT NULL,           -- blueprint key in /blueprints
  stage TEXT,                        -- current stage key (validation blueprints) or NULL for departments
  owner TEXT NOT NULL DEFAULT 'founder',
  status TEXT NOT NULL DEFAULT 'active', -- active | parked | killed | graduated
  mission TEXT,
  meta TEXT NOT NULL DEFAULT '{}',   -- json
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(company_id, slug)
);

CREATE TABLE IF NOT EXISTS gate_evidence (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  stage TEXT NOT NULL,
  criterion TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | met | waived
  evidence TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(unit_id, stage, criterion)
);

CREATE TABLE IF NOT EXISTS initiatives (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  title TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | done | dropped
  priority INTEGER NOT NULL DEFAULT 2,   -- 1 high, 2 normal, 3 low
  owner TEXT NOT NULL DEFAULT 'founder',
  due TEXT,
  goal_id TEXT,
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  initiative_id TEXT REFERENCES initiatives(id),
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | doing | blocked | done | dropped
  priority INTEGER NOT NULL DEFAULT 2,
  owner TEXT NOT NULL DEFAULT 'founder', -- founder | agent:<name> | <person>
  due TEXT,
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id),
  title TEXT NOT NULL,
  context TEXT,
  options TEXT NOT NULL DEFAULT '[]', -- json array of strings
  decision TEXT,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | decided
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id),
  kind TEXT NOT NULL,                -- next_step | outreach_batch | outreach_message | stage_gate | spend | publish | other
  title TEXT NOT NULL,
  proposal TEXT NOT NULL,            -- what will happen if approved (markdown)
  why_now TEXT,
  evidence TEXT,
  exposure TEXT,                     -- cost / reversibility
  alternatives TEXT,
  recommendation TEXT,
  risk_level INTEGER NOT NULL DEFAULT 1, -- 0 autonomous, 1 batch, 2 single-action, 3 founder-only
  payload TEXT NOT NULL DEFAULT '{}',    -- json, machine-actionable
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | changes_requested | executed | expired
  requested_by TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  company_name TEXT NOT NULL,
  segment TEXT,                      -- fmcg | tech | travel | agency | student | retailer | ...
  website TEXT,
  country TEXT,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  linkedin TEXT,
  fit_score INTEGER,                 -- 0-100
  status TEXT NOT NULL DEFAULT 'new', -- new | researched | queued | contacted | replied | meeting | proposal | won | lost | disqualified
  research TEXT,                     -- markdown research notes (agent output)
  angle TEXT,                        -- the outreach angle / hook
  source TEXT,
  next_action_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  approval_id TEXT REFERENCES approvals(id),
  channel TEXT NOT NULL DEFAULT 'email', -- email | linkedin | call
  sequence_step INTEGER NOT NULL DEFAULT 1,
  to_email TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | sent | replied | bounced | cancelled
  external_id TEXT,                  -- gmail draft/message id
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  stage TEXT,
  hypothesis TEXT NOT NULL,
  method TEXT,                       -- landing_page | waitlist | preorder | interviews | outreach_test | pricing_test | ...
  metric TEXT,
  target TEXT,
  result TEXT,
  learning TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | running | passed | failed | inconclusive
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  key TEXT NOT NULL,
  value REAL NOT NULL,
  period TEXT NOT NULL,              -- e.g. 2026-09 or 2026-W37
  note TEXT,
  recorded_at TEXT NOT NULL,
  UNIQUE(unit_id, key, period)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  unit_id TEXT REFERENCES units(id),
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running | completed | failed
  summary TEXT,
  outputs TEXT NOT NULL DEFAULT '[]', -- json
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id),
  kind TEXT NOT NULL DEFAULT 'note',  -- note | research | feedback | brief | memo
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  unit_id TEXT,
  type TEXT NOT NULL,
  ref_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_unit ON tasks(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_unit ON leads(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  unit_id TEXT REFERENCES units(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  horizon TEXT NOT NULL DEFAULT '12m',    -- 12m | 36m
  metric_key TEXT,                        -- optional: pull current from metrics on unit_id
  baseline REAL,
  current REAL,
  target REAL NOT NULL,
  unit_label TEXT,                        -- EUR, %, brands, months, hours/week
  direction TEXT NOT NULL DEFAULT 'up',   -- up | down
  start TEXT NOT NULL,                    -- YYYY-MM-DD
  deadline TEXT NOT NULL,                 -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'active',  -- active | achieved | dropped
  note TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, key)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,                  -- json content blocks
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session, created_at);
