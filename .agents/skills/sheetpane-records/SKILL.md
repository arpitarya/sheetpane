---
name: sheetpane-records
description: Use when contributing to the sheetpane repo and a change touches a rule - finding the record that owns a module, the laws, the commit guard, where a rule lives, archive-is-not-evidence. Not for host apps.
license: MIT
metadata:
  audience: contributor
---

# The standing records (contributors)

**Records are the only source of truth; laws outrank every other record**
([SR-LAW-0](https://github.com/arpitarya/sheetpane/blob/main/records/0002_LAW-0-authority.md)). A rule lives in exactly one
record; everything else points to it.

| you want | read |
|---|---|
| which record owns a file | [`records/README.md`](https://github.com/arpitarya/sheetpane/blob/main/records/README.md) §Ownership |
| the laws L0–L10 | [SR-LAWS](https://github.com/arpitarya/sheetpane/blob/main/records/0001_LAWS.md) and the records it routes to |
| how work is done | the WORK records `0051`–`0060` |
| a closed fork and its reopen-trigger | [`work/compare/`](https://github.com/arpitarya/sheetpane/blob/main/work/compare/README.md) |

## Changing code

- **The commit guard** (`scripts/sr-guard.sh`, a `commit-msg` hook) refuses a
  commit that changes an owned component without staging its owning record
  — or a line `no SR affected` when no rule changed
  ([SR-WORK-OWNERSHIP](https://github.com/arpitarya/sheetpane/blob/main/records/0058_WORK-ownership.md)).
- Update the record **in the same change** as the code it describes.
- **Archive is not evidence:** never cite `archive/` to justify a claim
  ([SR-WORK-ARCHIVE](https://github.com/arpitarya/sheetpane/blob/main/records/0057_WORK-archive.md)).
- Every task updates OPEN-WORK, the register, WORKLOG, INTERVIEW, the
  registry, README/CHANGELOG and the glossary as needed
  ([SR-WORK-DOCS](https://github.com/arpitarya/sheetpane/blob/main/records/0055_WORK-docs.md) decision 10).

## Related

[sheetpane-file-work-item](../sheetpane-file-work-item/SKILL.md)
