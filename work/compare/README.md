---
type: Index
description: "Index of the live forks: verdict first, every one with a reopen-trigger."
---

# `work/compare/` — live forks, verdict first

One doc per **live fork**: a decision with real options, an experiment, or an
alternative implementation that exists alongside the current one. Every doc
carries a **verdict** and an explicit **reopen-trigger** — a condition, not a
date. Fork or idea? A fork has options now → here; an undecided idea →
[`../proposals/`](../proposals/README.md).

Convention: `> **Verdict:**` blockquote first (status · the call · confidence ·
reopen-trigger), then Context → Options → Matrix → Consequences → References →
Reopen-trigger. File name `<name>.compare.md`. When a fork is decided and
built, its trigger is ported into the owning record and the doc moves to
`archive/compare/` with a map row.

| doc | fork | verdict | reopen-trigger |
|-----|------|---------|----------------|
