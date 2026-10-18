---
type: Reference
description: "Environment and tooling quirks of wherever this runs — why a command fails on THIS surface."
---

# MACHINE — the surfaces this runs on

One section per surface (a laptop, a CI runner, a Cowork bridge shell). A row
is added when something fails for a reason the code did not cause.

| surface | symptom | cause | what to type instead |
|---|---|---|---|
| Arpit's MacBook (macOS 27 / Darwin 27, 2026-10-18) | `SP_BROWSERS=…firefox…` fails: `browserType.launch … firefox … Could not find profile folder`, exit 1 — also outside the Claude Code sandbox | Playwright 1.64.1's Firefox build does not start on this macOS; Chromium and WebKit do | run Firefox through the nightly workflow on Linux (`gh workflow run nightly`), locally `SP_BROWSERS=chromium,webkit` |
