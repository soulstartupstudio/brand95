# Skills catalog

Skills live in `.claude/skills/<name>/SKILL.md`. Two kinds:

## Jarvis skills (written for this command center)

`/next` `/review` `/execute` `/brief` `/weekly` `/research-leads` `/outreach` `/send-approved` `/validate` `/research` `/write` `/finance-review` `/ops-review` `/new-unit`. They read and write state through the `jarvis` CLI and stop at approval gates. See `docs/agents.md`.

## Vendored skills (MIT, snapshot 2026-09-15)

Selected from public collections after reviewing the source. Each folder keeps the upstream `LICENSE` and an `ATTRIBUTION.md`. They are frameworks and procedures; they do not touch the command center database. Jarvis agents call them for craft, then store the result with `jarvis note` / `jarvis lead` / `jarvis draft`.

| Skill | From | Used by | Why it earned a place |
|---|---|---|---|
| `cold-email` | coreyhaines31/marketingskills (50k★) | outreach-writer | Reply-rate craft: subject lines, first lines, follow-up cadence, deliverability. |
| `prospecting` | coreyhaines31/marketingskills | lead-researcher | List building and qualification across B2B and local; signal-based sourcing. |
| `lead-scoring` | shawnpang/startup-founder-skills | lead-researcher | ICP definition and a scoring model; matches the `fit_score` field. |
| `pricing` | coreyhaines31/marketingskills | writer, cofounder | Packaging and price-increase logic for brandshops / portals / recurring setups. |
| `product-marketing` | coreyhaines31/marketingskills | writer | Positioning context document for Custom95 and each brand. |
| `sales-enablement` | coreyhaines31/marketingskills | writer | One-pagers, decks, objection handling. |
| `proposal-generation` | shawnpang/startup-founder-skills | writer | Proposals, SOWs, quotes for key accounts. |
| `cro` | coreyhaines31/marketingskills | concept-validator | Landing-page conversion for validation experiments. |
| `customer-research` | coreyhaines31/marketingskills | research | Interview guides, transcript synthesis for Discover / Problem stages. |
| `market-research` | shawnpang/startup-founder-skills | research | Market sizing that separates facts from estimates. |
| `competitive-analysis` | shawnpang/startup-founder-skills | research | Competitor map for Discover. |
| `startup-competitors` | ferdinandobons/startup-skill (909★) | research | Battle cards, pricing landscape from web data. |
| `startup-positioning` | ferdinandobons/startup-skill | writer, research | Dunford positioning + JTBD; used for Brand95 Stage 3. |
| `startup-design` | ferdinandobons/startup-skill | concept-validator, cofounder | Full validation program with go / no-go gates; the SSS Stage 0–2 companion. |
| `mvp-scoping` | shawnpang/startup-founder-skills | cofounder, concept-validator | What to build, cut, defer (PortaPay). |
| `board-update` | shawnpang/startup-founder-skills | cofounder (weekly/monthly) | Investor-grade monthly update format; reused for the founder's own monthly review. |

## Reviewed and not vendored

- **emelia-io/claude-outreach** (MIT): complete outbound stack, but enrichment, email finding and sending require an Emelia account. Revisit if you adopt Emelia; otherwise the Gmail connector plus `cold-email` covers sending.
- **kmorgan-r/claude-skills find-cold-leads**: Apollo-dependent, no explicit license.
- **anthropics/skills**: document/creative skills (docx, pptx, pdf, xlsx) are already available in Claude; nothing business-specific to add.
- **huggingface/skills**: Hugging Face ecosystem tooling (models, datasets, training). Not relevant to this operating system.

## Refreshing

```bash
git clone --depth 1 https://github.com/coreyhaines31/marketingskills /tmp/ms && cp -r /tmp/ms/skills/cold-email .claude/skills/
```

Keep `LICENSE` and `ATTRIBUTION.md` in the folder. Do not edit vendored SKILL.md files in place; wrap them from a Jarvis agent instead so upstream refreshes stay clean.
