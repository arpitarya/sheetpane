import { describe, expect, it } from 'vitest';
import { applyTint, DEFAULT_INDEXED, DEFAULT_THEME, mix, resolveColor } from '../src/index.js';

const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace(/^#?/, '#').slice(i, i + 2), 16));
/** Excel's palette swatches are within ±2 per channel of the documented tint algorithm. */
const near = (got: string, want: string) => channels(got).every((v, i) => Math.abs(v - channels(want)[i]!) <= 2);

describe('resolveColor', () => {
  it('rgb: ARGB drops the alpha byte; RRGGBB is taken as is', () => {
    expect(resolveColor({ rgb: 'FF2346C8' })).toBe('#2346C8');
    expect(resolveColor({ rgb: '002346C8' })).toBe('#2346C8');
    expect(resolveColor({ rgb: 'fff2cc' })).toBe('#FFF2CC');
    expect(resolveColor({ rgb: 'nonsense' })).toBeUndefined();
  });
  it('auto and nothing resolve to undefined — the caller decides what automatic means', () => {
    expect(resolveColor({ auto: true })).toBeUndefined();
    expect(resolveColor(undefined)).toBeUndefined();
    expect(resolveColor({})).toBeUndefined();
  });
  it('theme: the workbook theme by SpreadsheetML index (0 lt1, 1 dk1), else the Office default', () => {
    expect(resolveColor({ theme: 1 })).toBe('#000000');
    expect(resolveColor({ theme: 0 })).toBe('#FFFFFF');
    expect(resolveColor({ theme: 4 })).toBe(`#${DEFAULT_THEME[4]}`);
    const theme = [...DEFAULT_THEME]; theme[4] = '112233';
    expect(resolveColor({ theme: 4 }, { theme })).toBe('#112233');
  });
  it('theme + tint follows Excel (lighter and darker swatches of the Office palette)', () => {
    const cases: [number, number, string][] = [
      [4, 0.7999816888943144, 'D9E1F2'], [4, 0.5999938962981048, 'B4C6E7'], [4, 0.3999755851924192, '8EA9DB'], [4, -0.249977111117893, '2F5597'],
      [0, -0.0499893185216834, 'F2F2F2'], [0, -0.1499984740745262, 'D9D9D9'], [0, -0.249977111117893, 'BFBFBF'], [0, -0.499984740745262, '808080'],
      [1, 0.499984740745262, '808080'], [1, 0.34998626667073579, '595959'], [1, 0.0499893185216834, '0D0D0D'],
      [5, 0.3999755851924192, 'F4B084'], [5, -0.249977111117893, 'C65911'], [9, 0.5999938962981048, 'C6E0B4'],
    ];
    for (const [theme, tint, want] of cases) expect(near(resolveColor({ theme, tint })!, want), `theme ${theme} tint ${tint}`).toBe(true);
    expect(applyTint('808080', 0)).toBe('808080');
    expect(applyTint('4472C4', 1)).toBe('FFFFFF');
    expect(applyTint('4472C4', -1)).toBe('000000');
  });
  it('tint applies to rgb colours too', () => {
    expect(near(resolveColor({ rgb: 'FF4472C4', tint: 0.5999938962981048 })!, 'B4C6E7')).toBe(true);
  });
  it('indexed: the default 64-colour palette, 64 = system text, 65 = system background, or the file override', () => {
    expect(DEFAULT_INDEXED).toHaveLength(64);
    expect(resolveColor({ indexed: 2 })).toBe('#FF0000');
    expect(resolveColor({ indexed: 10 })).toBe('#FF0000');
    expect(resolveColor({ indexed: 22 })).toBe('#C0C0C0');
    expect(resolveColor({ indexed: 64 })).toBe('#000000');
    expect(resolveColor({ indexed: 65 })).toBe('#FFFFFF');
    expect(resolveColor({ indexed: 99 })).toBeUndefined();
    expect(resolveColor({ indexed: 2 }, { indexed: ['FF000000', 'FFFFFFFF', 'FF123456'] })).toBe('#123456');
  });
  it('mix blends two colours', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#FF0000', '#0000FF', 1)).toBe('#FF0000');
  });
});
