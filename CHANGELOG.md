# Changelog

Every package is versioned in lockstep (SR-BUILD); nothing is published yet.
Newest first. The specs are the records in [`records/`](records/README.md).

## Unreleased

### Changed

- **Range selection is smooth and does more** (W-46). The selection is one
  layer — a fill, one border, the active cell left clear — so a drag no longer
  redraws the cells (on 250,000 rows: no dropped frame dragging with
  autoscroll). Drag past an edge to scroll; click column or row headers or
  the corner; Ctrl/⌘+arrows, Ctrl+Space, Shift+Space, Ctrl/⌘+A,
  Shift+Backspace; Enter / Tab inside a range. A range copies as a grid
  (TSV + HTML), clears with Delete, fills from one pasted value, and shows
  Count · Sum · Average. `sheetpane-select` gains `range` and fires once per
  drag, on release. Touch: two handles. **Removed:** the cells' internal
  `.inrange` / `.sel` classes (in the shadow root, never host-facing).
