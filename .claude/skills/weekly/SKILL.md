---
name: weekly
description: Weekly CEO review. Refreshes KPIs, finds the biggest bottleneck per unit, reviews experiments and pipeline, proposes max three priorities per company as approval requests, and stores the review as a note.
---

Run the weekly CEO review (Monday ritual).

1. Gather: `npm run jarvis -- status --json`, `npm run jarvis -- next --json`, `npm run jarvis -- experiments --json`, `npm run jarvis -- outreach --json`, `npm run jarvis -- events --limit 200 --json`.
2. Ask the founder for numbers the system cannot pull (cash, revenue MTD) unless the `finance` agent can fetch them. Record them with `jarvis metric`.
3. Per company, write: biggest bottleneck · what moved last week (from events) · KPIs vs target · experiments passed/failed · pipeline health · kill/park candidates · **max 3 priorities for next week**.
4. Store it: `npm run jarvis -- note - "Weekly review YYYY-WW" --kind memo --body "<markdown>"`.
5. Turn each priority into either a task (`jarvis task`) or, if it changes direction or spends money, an approval request (`jarvis request … --risk 3`).
6. Reply with the review and the list of approval ids. Stop.
