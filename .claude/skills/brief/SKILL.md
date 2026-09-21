---
name: brief
description: Founder brief with judgment. Runs the portfolio brief, then adds the three priorities for today, what to drop, and what is waiting on the founder.
---

1. Run `npm run jarvis -- brief $ARGUMENTS` and read it.
2. On top of the raw brief, answer in ≤ 200 words:
   - **Three priorities today** (each tied to a North Star).
   - **Waiting on you**: approvals and open decisions, with ids.
   - **Drop or park**: anything that is noise this week.
   - **One warning** if a portfolio rule is broken or the founder is over-parallelized.
3. Offer to save it: `npm run jarvis -- brief --out data/briefs/YYYY-MM-DD.md` (create the folder if needed).
