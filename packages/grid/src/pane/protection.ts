// Sheet and workbook protection honoured in Edit (W-62, SR-GRID decision 21d): what the file locks, read from a
// snapshot so a plugin control's `disabled(snap, sel)` asks the same question the store does. Never the password.
import { parseRef } from '@sheetpane/export';
import { cellProtection, type SheetProtection } from '@sheetpane/import';
import type { ProtectionMode, Snapshot } from './types.js';

export type { ProtectionMode };
/** The values `protection` takes; anything else is `honour`. */
export const PROTECTION_MODES: readonly ProtectionMode[] = ['honour', 'ignore'];
/** What the grid says on a refused edit, beside SP-3020. */
export const LOCKED_MESSAGE = 'Locked in the file';
/** What a structural control says while the workbook's structure is protected (`disabledReason`). */
export const STRUCTURE_LOCKED_MESSAGE = 'Locked in the file — the workbook’s structure is protected';

/**
 * A `protection` attribute value as a mode: `ignore`, else `honour`.
 * @param v - The attribute or property value.
 * @returns The mode.
 */
export const protectionModeOf = (v: unknown): ProtectionMode => (v === 'ignore' ? 'ignore' : 'honour');

/**
 * A sheet's protection while the pane honours it: the file's `<sheetProtection>`, or undefined when the sheet is
 * not protected or the host set `protection="ignore"`.
 * @param snap - The pane's snapshot.
 * @param sheet - The sheet's name.
 * @returns The switches (`true` = refused while protected), or undefined.
 */
export function sheetProtectionIn(snap: Snapshot, sheet: string): SheetProtection | undefined {
  if (snap.protection === 'ignore') return undefined;
  return snap.book?.sheets.find((s) => s.name === sheet)?.protection;
}

/**
 * Whether a cell refuses edits: its sheet is protected (and honoured) and its effective format is locked — Excel's
 * default for every cell until someone unlocks it.
 * @param snap - The pane's snapshot.
 * @param sheet - The sheet's name.
 * @param ref - The cell, `A1`.
 * @returns True when typing, paste and Delete are refused there.
 */
export function lockedIn(snap: Snapshot, sheet: string, ref: string): boolean {
  if (snap.protection === 'ignore' || !snap.book) return false;
  const s = snap.book.sheets.find((x) => x.name === sheet), p = parseRef(ref);
  if (!s?.protection || !p) return false;
  return cellProtection(s, snap.book.styles, p.row, p.col).locked;
}

/**
 * Whether a cell's formula is hidden: its sheet is protected (and honoured) and its format says `hidden`. The cell
 * shows its value only — never its formula, in the cell bar or a plugin's `fx`.
 * @param snap - The pane's snapshot.
 * @param sheet - The sheet's name.
 * @param ref - The cell, `A1`.
 * @returns True when the formula is not shown.
 */
export function formulaHiddenIn(snap: Snapshot, sheet: string, ref: string): boolean {
  if (snap.protection === 'ignore' || !snap.book) return false;
  const s = snap.book.sheets.find((x) => x.name === sheet), p = parseRef(ref);
  if (!s?.protection || !p) return false;
  return cellProtection(s, snap.book.styles, p.row, p.col).hidden;
}

/**
 * Whether the workbook's structure is protected (`<workbookProtection lockStructure="1">`, honoured): sheets may not
 * be hidden or unhidden, and rows and columns not inserted or deleted. The one predicate structural controls ask.
 * @param snap - The pane's snapshot.
 * @returns True while structural edits are refused.
 */
export function structureLockedIn(snap: Snapshot): boolean {
  return snap.protection !== 'ignore' && !!snap.book?.workbookProtection?.lockStructure;
}
