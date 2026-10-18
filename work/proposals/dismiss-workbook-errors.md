---
type: Proposal
title: Dismiss a workbook-authored error for this review
description: "Let a reviewer hide a validation warning the workbook raised (e.g. a rule they accept for this file). Parked: W-18 keeps workbook rows read-only until the cell passes."
status: proposed
timestamp: 2026-10-18T18:30:00+05:30
---

# Dismiss a workbook-authored error for this review

## The idea

`@sheetpane/validation` (W-18) turns the workbook's own data-validation rules
into errors from author `workbook`. They are read-only and resolve themselves
when the cell passes. The Plugin-Validation design board added a **Dismiss**
button: the reviewer accepts the value for this review, the row hides, and the
dismissal travels in the saved review so it does not come back on reload.

## Why it is parked, not built

- W-18 as filed has no Dismiss; the board drew it as an idea, not a ruling.
- It needs a field on the error (`dismissed`, by whom, when) — a change to the
  error contract every host reads.
- A wrong value that is dismissed still exports; the review then says nothing
  about it. That is the reviewer's call, but it should be a ruled one.

## Graduation trigger

A host asks for it once W-18 lands, or the decider rules it in; then a
`W-nn` amends W-18 and the error contract.

## Reference

- [W-18](../open/W-18-validation.md) · board [`Plugin-Validation`](../reference/design/boards/Plugin-Validation.dc.html)
