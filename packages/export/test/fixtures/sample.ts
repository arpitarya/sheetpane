// The design's sample workbook (board `Sheetpane`, renderVals()), as the object
// @sheetpane/export takes. Shared by every package's tests and the demos.
import type { Workbook } from '../../src/index.js';

const HDR = ['Account ID', 'Client', 'Advisor', 'Security', 'Ticker', 'Units', 'Price', 'Market value', 'Fee rate', 'As of'];
const D: (string | number | null)[][] = [
  ['AC-10021', 'R. Mehta', 'S. Kapoor', 'Total Market Index Fund', 'TMKT', 1200, 268.4, 322080, '0.75%', '30-Sep-2026'],
  ['AC-10021', 'R. Mehta', 'S. Kapoor', 'Short-Term Bond Fund', 'STBF', 850, 101.12, 85952, '0.40%', '30-Sep-2026'],
  ['AC-10037', 'L. Fernandes', 'A. Rao', 'Dividend Growth ETF', 'DIVG', 430, 74.85, 32185.5, '0.75%', '30-Sep-2026'],
  ['AC-10037', 'L. Fernandes', 'A. Rao', 'Global Equity Fund', 'GLEQ', 2000, 45.1, 90200, '7.5%', '30-Sep-2026'],
  ['AC-10042', 'P. Iyer', 'S. Kapoor', 'Total Market Index Fund', 'TMKT', 300, 286.4, 85920, '0.75%', '30-Sep-2026'],
  ['AC-1O044', 'K. Sharma', 'A. Rao', 'Municipal Bond Fund', 'MUNI', 640, 52.3, 33472, '0.40%', '30-Sep-2026'],
  ['AC-10044', 'K. Sharma', 'A. Rao', 'Real Estate Income Fund', 'REIF', 210, 38.95, 8179.5, '0.85%', '30-Sep-2026'],
  ['AC-10051', 'M. D’Souza', 'S. Kapoor', 'Small-Cap Value ETF', 'SCVE', -150, 61.2, -9180, '0.75%', '30-Sep-2026'],
  ['AC-10051', 'M. D’Souza', null, 'Treasury Inflation Fund', 'TIPF', 500, 27.64, 13820, '0.40%', '30-Sep-2026'],
  ['AC-10063', 'N. Gupta', 'A. Rao', 'Total Market Index Fund', 'TMKT', 195, 268.4, 48210, '0.75%', '30-Sep-2026'],
  ['AC-10063', 'N. Gupta', 'A. Rao', 'Short-Term Bond Fund', 'STBF', 1000, 101.12, 101120, '0.40%', '31-Sep-2026'],
  ['AC-10037', 'L. Fernandes', 'A. Rao', 'Dividend Growth ETF', 'DIVG', 430, 74.85, 32185.5, '0.75%', '30-Sep-2026'],
  ['AC-10070', 'V. Nair', 'S. Kapoor', 'Global Equity Fund', 'GLEQ', 820, 45.1, 36982, '0.75%', '30-Sep-2026'],
];

/** Pixel widths from the board, as Excel character widths (px ≈ 7·w + 5). */
const ch = (px: number) => Math.round(((px - 5) / 7) * 100) / 100;

export const SAMPLE_BOOK: Workbook = {
  sheets: [
    {
      name: 'Holdings',
      rows: [['Client holdings — as of 30 Sep 2026'], HDR, ...D],
      merges: ['A1:J1'],
      columnWidths: [84, 110, 96, 168, 64, 70, 76, 108, 70, 100].map(ch),
    },
    {
      name: 'Fee tiers',
      rows: [
        ['Fee tiers — 2026'],
        ['Tier', 'Min assets', 'Max assets', 'Annual rate', 'Applies to'],
        ['Core', 0, 250000, '0.75%', 'Equity funds and ETFs'],
        ['Income', 0, '—', '0.40%', 'Bond funds'],
        ['Real assets', 0, '—', '0.85%', 'Real estate funds'],
        ['Cap', null, null, '2.00%', 'Any single holding (maximum)'],
      ],
      merges: ['A1:E1'],
      columnWidths: [120, 120, 120, 110, 240].map(ch),
    },
  ],
};

/** The CSV sample: the Holdings sheet without its title row. */
export const SAMPLE_CSV_SHEET = { name: 'Holdings', rows: SAMPLE_BOOK.sheets[0]!.rows.slice(1) };
