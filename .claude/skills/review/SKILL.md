---
name: review
description: Review checkpoint. Shows everything waiting on the founder (approvals, open decisions, experiments with results due) and walks through them one by one. Use before continuing execution.
---

1. `npm run jarvis -- approvals --json`, `npm run jarvis -- decisions --status open --json`, `npm run jarvis -- experiments --json` (status running).
2. Present each item in one block: what · why · recommendation · the exact commands to approve / reject / request changes / decide.
3. Ask the founder for decisions one item at a time. Apply each with the CLI (`jarvis approve|reject|changes`, `jarvis decide`). Never decide for them.
4. When the inbox is empty, say so and suggest `/execute`.
