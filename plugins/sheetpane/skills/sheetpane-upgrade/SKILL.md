---
name: sheetpane-upgrade
description: Use when moving a host to a newer sheetpane version - reading CHANGELOG.md, the lockstep version rule, removed or renamed controls and events, re-checking a host's tests. Not for first-time setup (sheetpane-setup).
license: MIT
metadata:
  audience: host
---

# Upgrading

1. **Every `@sheetpane/*` package shares one version** — upgrade them all
   together ([SR-BUILD](https://github.com/arpitarya/sheetpane/blob/main/records/0102_BUILD.md) decision 9). Mixed versions are
   not supported.
2. Read [`CHANGELOG.md`](https://github.com/arpitarya/sheetpane/blob/main/CHANGELOG.md) from your version up. "Changed"
   and "Removed" entries are the breaking ones.
3. Re-run `npx sheetpane-skills install` so these skills match the version.
4. Run your host's tests; assert error **codes**, which are permanent
   ([SR-CODES](https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md)), not message text.

## Changes hosts have met

| change | was | now |
|---|---|---|
| one Download button (W-31) | Export + Download the original | one button; untouched → the original bytes |
| Download split button (W-34) | blue primary button | neutral; ▾ for .xlsx / .csv; `sheetpane-export` gains `format`, `converted` |
| docked selection actions (W-31) | a floating bar over the cells | at the cell bar's end and on right-click; the `selbar` slot id is unchanged |
| error codes (W-40) | text messages | `SP-xxxx` prefix and `spCode`; the old text is kept after the code |

## Pitfalls

- A test that clicked `.selbar` buttons now finds them in the cell bar's
  docked group.
- The `.orig` button is gone; use the Download button or `export()`.

## Related

[sheetpane-setup](../sheetpane-setup/SKILL.md) · [sheetpane-testing](../sheetpane-testing/SKILL.md)
