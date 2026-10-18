---
type: Handoff
name: W-44
description: "Arpit, 2026-10-18: publish the plugin gallery as a live site on every release and give each starter template an Open-in-StackBlitz link, so anyone can try sheetpane without installing it."
item: W-44
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-44 — A live playground: the demo gallery online, templates in StackBlitz

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | CI builds the HTML and React demos (the W-32 gallery) and deploys them to GitHub Pages on each release tag | try every plugin in a browser, no install | ⏳ |
| 2 | An "Open in StackBlitz" link per template ([W-43](W-43-create-sheetpane.md)) | edit a real project in the browser | ⏳ |
| 3 | Link both from the READMEs, `llms.txt` and the setup skill | people and agents find them | ⏳ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Haiku — a CI job and links.

## Goal

One URL shows the latest release's gallery; one click per template opens an editable project.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · deploy | a GitHub Actions job on release tags builds both demos and publishes them to GitHub Pages (`/` the HTML gallery, `/react/` the React one), version in the header | ✅ `.github/workflows/pages.yml`: on a `v*` tag (or by hand) `just site` builds `site/` — the HTML gallery at `/` with every file its import map names copied in, the React gallery at `/react/` (relative base) — runs `demo-check` on the site itself (49 ✓ locally), then `actions/deploy-pages`; the version in both headers. **Enabling Pages (Settings → Pages → GitHub Actions) is the decider's**, once |
| 2 · StackBlitz | a `stackblitz.com/github/arpitarya/sheetpane/tree/<tag>/…` link per template, checked to load in CI | ✅ built: `examples/starters/<t>` scaffolded by the CLI (`just starters`, rerun by `release.mjs`), an index with a `stackblitz.com/github/arpitarya/sheetpane/tree/<ref>/examples/starters/<t>` link each; `test/starters.test.ts` checks freshness and each folder. **Not** loaded in CI: StackBlitz installs from npm, so they load once a version is published — checked then |
| 3 · links | package READMEs, `llms.txt` ([W-38](W-38-llms-txt.md)), the setup skill | ✅ root README ("Try it"), grid README, `create-sheetpane` README, `llms.txt` ("Try it"), the setup skill |
| 4 · record | SR-BUILD (the deploy job) | ✅ SR-BUILD decisions 8 (the deploy job) and 8b (starters and links) |

## Blockers

**The decider:** enable GitHub Pages (Settings → Pages → Source: GitHub Actions) and publish the first release. Then an agent checks that the playground loads at https://arpitarya.github.io/sheetpane/ and that each starter loads in StackBlitz, and closes this item. Everything else is built (W-43 landed).

## Record affected

[SR-BUILD](../../records/0102_BUILD.md).

## Hazards

- **Pages serves the built output**, not the workspace — the import map must point at files inside the deploy.
- **No analytics, no third-party scripts** on the site.

## Research

- GitHub Pages deploys from Actions (`actions/deploy-pages`); StackBlitz opens a public GitHub path directly, no account needed to view.

## Reference

- [W-32](../../archive/open/W-32-plugin-gallery-demos.md) · [W-43](W-43-create-sheetpane.md) · [W-38](W-38-llms-txt.md)

## Prompt — paste into Claude Code

```text
You are building W-44 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, .github/workflows/, examples/, records/0102_BUILD.md and this file
   (work/open/W-44-live-playground.md). Check the state of: W-38, W-43.
2. Plan the deploy job and the link list before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement the workflow and the README links.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
