---
name: research-leads
description: Research B2B target accounts for a sales unit. Usage: /research-leads <company/slug> <segment> <count>. Adds scored leads with contact, research note and outreach angle. Never contacts anyone.
---

Parse `$ARGUMENTS` as `<unit> <segment> <count>` (defaults: `custom95/sales fmcg 10`).

Use the `lead-researcher` agent with those inputs. When it finishes, reply with: the run summary, the top 5 leads (fit, company, angle), and the command to draft outreach (`/outreach <unit>`).
