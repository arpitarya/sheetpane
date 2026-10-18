// SR-WORK-SESSION decision 13's second gate: a commit where a file loses more than half its lines is
// refused unless the message says `shrink ok` (scripts/shrink-guard.sh, run by the commit-msg hook).
import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guard = join(import.meta.dirname, '../scripts/shrink-guard.sh');

describe('shrink-guard (SR-WORK-SESSION decision 13)', () => {
  it('refuses a halved file, allows a small cut, and lets `shrink ok` through', () => {
    const d = mkdtempSync(join(tmpdir(), 'sp-shrink-'));
    try {
      const git = (...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: d });
      git('init', '-q');
      writeFileSync(join(d, 'log.md'), Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') + '\n');
      git('add', 'log.md'); git('commit', '-qm', 'one');
      const run = (msg: string) => { writeFileSync(join(d, 'MSG'), msg); return spawnSync('bash', [guard, join(d, 'MSG')], { cwd: d, encoding: 'utf8' }); };
      writeFileSync(join(d, 'log.md'), 'new entry\nline 0\n');
      git('add', 'log.md');
      const refused = run('add an entry\n');
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('log.md (40 → 2 lines)');
      expect(run('cut the log\n\nshrink ok\n').status).toBe(0);
      writeFileSync(join(d, 'log.md'), Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n');
      git('add', 'log.md');
      expect(run('trim a little\n').status).toBe(0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
