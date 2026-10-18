---
type: Queue
description: "The named-but-unclaimed: everything a record, proposal or compare doc says is outstanding and nobody is doing. The list only — its rules live in the record below."
governed_by: SR-WORK-BACKLOG
governed_by_path: records/0052_WORK-backlog.md
---

# BACKLOG — what has been named and is not being done

**This file is the LIST.** Everything else — what the backlog is, what feeds
it, the shape of a row, the five classes, how an item leaves, and the one
obligation it puts on every session — is stated once in
**[SR-WORK-BACKLOG](../records/0052_WORK-backlog.md)** and is not repeated here.

⚠ **Its length is not a signal.** `OPEN-WORK.md`'s length is how much is
pending; this file's length is how honest the records have been. Do not trim
it, and do not read it top-down as a priority order.

**Nothing here is in [`OPEN-WORK.md`](OPEN-WORK.md).**

---

## `unbuilt` — a ratified decision the code does not implement

| id | what is outstanding | named in | what closes it |
|---|---|---|---|

---

## `ungated` — a stated rule nothing mechanically checks

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-001 | The queue's row rules (13–19, 42, 45) are enforced by nothing but the inbox-shape hook | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) Consequences | a test over `work/OPEN-WORK.md` rows, as a `W-nn` |
| B-002 | `owns:` ↔ Ownership table agreement is unchecked in either direction | [SR-WORK-OWNERSHIP](../records/0058_WORK-ownership.md) decision 2 | a test parsing both, as a `W-nn` |
| B-003 | The registry's decisions 5–8 are enforced by nothing | [SR-WORK-REGISTRY](../records/0060_WORK-registry.md) Consequences | a test over §3, as a `W-nn` |
| B-004 | A `W-nn` that resolves to neither `work/open/` nor `archive/open/` is caught by nobody | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) Consequences | a test, as a `W-nn` |
| B-005 | A second `archive/` directory anywhere is caught by nobody | [SR-WORK-ARCHIVE](../records/0057_WORK-archive.md) decision 1 | a test, as a `W-nn` |
| B-008 | No check refuses a non-FOSS licence in the dependency tree | [SR-LAW-2](../records/0004_LAW-2-foss-dependencies.md) Consequences | a licence check over the lockfile, run by the guard or CI, in the change that adds `package.json` |
| B-009 | No check refuses code that parses or writes a format other than XLSX or CSV | [SR-LAW-3](../records/0005_LAW-3-xlsx-and-csv-only.md) Consequences | a test that an unsupported file is refused, as a `W-nn` once file loading exists |
| B-012 | No check that `@sheetpane/grid` registers its custom elements on import (the no-framework-peer half is tested by SR-BUILD decision 7) | [SR-LAW-4](../records/0006_LAW-4-web-component.md) Consequences | a test over `package.json` and the entry point, in the change that adds them |
| B-017 | No test that an edited workbook, exported and loaded again, carries every change | [SR-LAW-6](../records/0008_LAW-6-edits-in-memory-export-with-changes.md) Consequences | a round-trip test, as a `W-nn` once edit and export exist |
| B-020 | No test that a change through one component appears in the other two | [SR-LAW-7](../records/0009_LAW-7-surfaces-always-in-sync.md) Consequences | a cross-component sync test, as a `W-nn` once two components exist |

---

## `unmeasured` — a live default, constant or claim with no measurement behind it

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-026 | The largest workbook sheetpane can hold in JavaScript objects before the tab struggles | [SR-LAW-9](../records/0011_LAW-9-memory-is-a-javascript-object.md) Consequences | a measurement on a named machine, recorded in the record that owns the workbook model |

---

## `unruled` — a fork named and not decided

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-028 | Live pivot tables — re-aggregating a pivot in the grid when its source cells change; v1 shows the cached cells and asks Excel to refresh on open | [`work/proposals/pivots.md`](proposals/pivots.md) | the proposal's graduation trigger: a host asks for it after W-16 lands, then the decider's ruling and a `W-nn` |
| B-025 | Connect the in-memory workbook to IndexedDB as well — the decider's request, deferred; e.g. behind a button | [SR-LAW-9](../records/0011_LAW-9-memory-is-a-javascript-object.md) Consequences | the decider's ruling rewriting SR-LAW-9 decisions 1–2 (and SR-LAW-6 decision 2) |

---

## `cost` — a consequence accepted deliberately

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-006 | The guard proves a record was touched, never that it is coherent; L0 obligation (iii) is judgment | [SR-LAW-0](../records/0002_LAW-0-authority.md) decision 1a | never graduates; it is the stated price of a mechanical gate |
| B-007 | The `Stop` hook relents after three refusals, so a blocker can be walked past | [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) decision 8 | never graduates; a hook that never relents is a hang |
