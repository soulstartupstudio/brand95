---
name: new-unit
description: Add a new department, venture, brand or concept to the command center with the right blueprint and its stage-0 intake as tasks. Usage: /new-unit <company> <slug> "Name" [kind] [blueprint].
---

Parse `$ARGUMENTS`. Defaults: kind `concept`, blueprint `venture-validation` (use `brand-blueprint` for Brand95 brands, `offer-validation` for new offers inside Custom95/Student95, `dept-*` for departments).

1. Check portfolio rules first (`npm run jarvis -- next --json` → `warnings`). If adding this unit breaks "one build, one validation" or "two ventures past intake", say so and ask what gets parked before creating it.
2. `npm run jarvis -- unit add <company> <slug> "<Name>" --kind <kind> --blueprint <bp> --mission "<one sentence>"`.
3. Read the first stage of the blueprint (`npm run jarvis -- gate <company>/<slug>`) and create one task per open criterion with `jarvis task`.
4. Reply with the unit ref, the stage-0 checklist and the first experiment to consider.
