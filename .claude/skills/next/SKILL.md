---
name: next
description: Co-founder loop. Reads the portfolio, proposes the single highest-leverage next step per unit as an approval request, then stops for founder review. Use for "what's next", "where should I focus", or the start of a working session.
---

Run the co-founder loop for `$ARGUMENTS` (a `company/slug`, a company, or empty for the whole portfolio).

1. Run `npm run jarvis -- next $ARGUMENTS --json` and `npm run jarvis -- approvals --json`.
2. If there are pending approvals, list them first (id, title, recommendation) and ask the founder to decide before proposing new work for those units.
3. Use the `cofounder` agent to turn the engine output into **one** proposed step per unit in focus (max 3 units), written as approval requests with `npm run jarvis -- request … --kind next_step`.
4. Reply in this shape:
   - **Decide now**: pending approvals (ids).
   - **Proposed** (per unit): step · why · approval id.
   - **Drop / park**: anything that is noise or breaks a portfolio rule.
5. Stop. Do not execute. The founder approves in the dashboard (`npm run serve`) or with `npm run jarvis -- approve <id>`.
