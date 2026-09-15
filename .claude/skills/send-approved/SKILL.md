---
name: send-approved
description: Send outreach that the founder approved, via the Gmail connector, and record each send. Usage: /send-approved <company/slug>. Refuses anything not approved.
---

Use the `outreach-sender` agent for unit `$ARGUMENTS`. Before starting, confirm with the founder whether to **send** or to **create Gmail drafts only** (default: drafts only the first time a unit sends).

Reply with sent/skipped counts and any errors.
