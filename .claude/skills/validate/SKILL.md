---
name: validate
description: Move a venture, concept or brand through its validation gate. Shows the open criteria, designs the next experiment, and proposes gate evidence. Usage: /validate <company/slug>.
---

For unit `$ARGUMENTS`:

1. `npm run jarvis -- gate <unit>` and `npm run jarvis -- experiments <unit> --json`.
2. If a running experiment has results the founder can report, ask for them and log them (`jarvis experiment-status <id> passed|failed --result .. --learning ..`), then propose which criteria are now met (`jarvis gate <unit> <criterion> met --evidence ".."`), only with the founder's confirmation.
3. Otherwise use the `concept-validator` agent to design the next experiment for the most important open criterion.
4. If the gate is complete, request the stage-gate approval: `npm run jarvis -- request <unit> --kind stage_gate --title "Advance <unit> to <next stage>" --risk 3 …`.
5. Reply with: gate status, experiment id (or approval id), the kill threshold. Stop.
