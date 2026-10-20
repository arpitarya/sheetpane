# Security policy

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.

You'll get an acknowledgement within 5 working days, and a fix or a plan within 30 days of confirming the issue.

## What counts

sheetpane opens untrusted files in your users' browsers, so these are in scope:

- **data leaving the browser** — any request other than the GETs for `src` and `rules-src` ([law L11](records/0013_LAW-11-workbook-stays-in-the-browser.md));
- **script injection** from a cell value, comment, sheet name, hyperlink or rules file into the host page;
- a crafted `.xlsx` or `.csv` that **hangs or exhausts** the tab out of all proportion to its size, or bypasses the refusals for macros, encryption and unsupported formats;
- an **export that corrupts** the original file in a way the round-trip tests should catch;
- anything in a published `@sheetpane/*` package that differs from this repository (each is published by CI with provenance — [RELEASING.md](RELEASING.md)).

A file that opens wrongly but harmlessly is a bug, not a vulnerability — please [open a file issue](https://github.com/arpitarya/sheetpane/issues/new?template=file_issue.yml).

## Supported versions

sheetpane is pre-1.0. Fixes go into the latest minor version only.
