// SR-WORK-SESSION decision 13, a gate after two strikes: two sessions wrote their entry inside the
// "Entry format" code block, where it renders as code. Every dated entry sits outside any fence,
// and the template block holds the template alone.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const text = readFileSync(join(import.meta.dirname, '../work/WORKLOG.md'), 'utf8');

describe('work/WORKLOG.md (SR-WORK-SESSION decisions 1, 13)', () => {
  it('no dated entry inside a code fence; the template block is the template alone', () => {
    let fenced = false;
    const inside: string[] = [];
    for (const line of text.split('\n')) {
      if (line.startsWith('```')) { fenced = !fenced; continue; }
      if (fenced && /^## \d{4}-\d{2}-\d{2}/.test(line)) inside.push(line.slice(0, 80));
    }
    expect(inside, 'entries written inside a fence — move them below the template').toEqual([]);
    const tpl = /\*\*Entry format:\*\*\n\n```\n([\s\S]*?)```/.exec(text)?.[1] ?? '';
    expect([...tpl.matchAll(/^## /gm)]).toHaveLength(1);
    expect(tpl.startsWith('## YYYY-MM-DD')).toBe(true);
  });
});
