// The grid README's rules-file example (W-33), shared by the tests.
/** The README's example, word for word. */
export const README_RULES = {
  $schema: 'https://unpkg.com/@sheetpane/grid/rules.schema.json',
  version: 1,
  sheets: {
    '*': { columns: { Email: { pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$', unique: true } } },
    Accounts: {
      headerRow: 2,
      columns: {
        'Account ID': { required: true, pattern: '^AC-\\d{5}$', message: 'Account IDs are AC- and five digits' },
        Units: { type: 'integer', min: 0 },
        Status: { oneOf: ['Active', 'Inactive'], noneOf: ['TBD', 'N/A'], severity: 'warning' },
      },
      cells: {
        B1: { equals: 'Q3 review', note: 'the title cell the export pipeline reads' },
        'H3:H40': { type: 'number', min: 0, max: 1 },
      },
    },
  },
};

