// Sequence alignment for rows (W-63): patience anchors (lines unique in both sides, kept in order
// by a longest increasing subsequence), Myers' O(ND) diff inside the gaps between them, and a
// cap — a gap whose edit distance passes it is left unmatched rather than searched for seconds.
// Every result is monotone: matched pairs increase on both sides.

/** How far Myers may search inside one gap before it gives up on that gap (edit distance). */
export const MYERS_CAP = 1000;

/**
 * The longest strictly increasing subsequence of `xs`, as the positions in `xs` it keeps.
 * @param xs - The numbers.
 * @returns Indexes into `xs`, ascending.
 */
export function lisIndexes(xs: ArrayLike<number>): number[] {
  const tails: number[] = []; // tails[l] = index into xs of the smallest tail of a run of length l+1
  const prev = new Int32Array(xs.length).fill(-1);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[tails[mid]!]! < x) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const out: number[] = [];
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prev[i]!) out.push(i);
  return out.reverse();
}

/**
 * Of matched pairs, the longest run in order on both sides — the pairs that did not move. Two
 * runs of the same length can differ (one row moved up, or the rows around it moved down): the
 * one whose pairs sit nearer their old places wins, so the row that travelled is the one left out.
 * @param pa - Each pair's position in the first sequence.
 * @param pb - Its position in the second.
 * @returns Indexes into the pairs, kept in order.
 */
export function inOrder(pa: readonly number[], pb: readonly number[]): Set<number> {
  const n = pa.length;
  const byA = Array.from({ length: n }, (_, i) => i).sort((x, y) => pa[x]! - pa[y]!);
  const byB = Array.from({ length: n }, (_, i) => i).sort((x, y) => pb[x]! - pb[y]!);
  const one = lisIndexes(byA.map((i) => pb[i]!)).map((k) => byA[k]!);
  const two = lisIndexes(byB.map((i) => pa[i]!)).map((k) => byB[k]!);
  const cost = (l: number[]) => l.reduce((t, i) => t + Math.abs(pa[i]! - pb[i]!), 0);
  return new Set(two.length > one.length || (two.length === one.length && cost(two) < cost(one)) ? two : one);
}

/** Myers' greedy diff of a[a0,a1) and b[b0,b1): the matched pairs, or undefined past `cap` edits. */
function myers(a: Int32Array, a0: number, a1: number, b: Int32Array, b0: number, b1: number, cap: number, outA: number[], outB: number[]): boolean {
  const n = a1 - a0, m = b1 - b0, lim = Math.min(n + m, cap), off = lim + 1;
  const v = new Int32Array(2 * lim + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= lim; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2)); // v as step d reads it: k in [-d-1, d+1]
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1]! < v[off + k + 1]!) ? v[off + k + 1]! : v[off + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[a0 + x] === b[b0 + y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) {
        // walk back through the trace, collecting the diagonals (the matches)
        const pa: number[] = [], pb: number[] = [];
        let cx = n, cy = m;
        for (let e = d; e >= 0; e--) {
          const t = trace[e]!, at = (kk: number) => t[kk + e + 1]!;
          const kk = cx - cy;
          const pk = kk === -e || (kk !== e && at(kk - 1) < at(kk + 1)) ? kk + 1 : kk - 1;
          const px = at(pk), py = px - pk;
          while (cx > px && cy > py) { cx--; cy--; pa.push(a0 + cx); pb.push(b0 + cy); }
          if (e > 0) { cx = px; cy = py; }
        }
        for (let i = pa.length - 1; i >= 0; i--) { outA.push(pa[i]!); outB.push(pb[i]!); }
        return true;
      }
    }
  }
  return false;
}

/**
 * Aligns two sequences of ids: equal ids that the alignment keeps in order.
 * @param a - The first sequence (row signatures as integer ids).
 * @param b - The second.
 * @param cap - Myers' edit-distance cap per gap.
 * @returns The matched positions, `a[i] === b[j]`, ascending on both sides.
 */
export function alignIds(a: Int32Array, b: Int32Array, cap = MYERS_CAP): { a: number[]; b: number[] } {
  const ra: number[] = [], rb: number[] = [];
  // explicit stack of gaps (no recursion depth on long files); pairs are sorted at the end
  const stack: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (stack.length) {
    let [a0, a1, b0, b1] = stack.pop()!;
    while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) { ra.push(a0++); rb.push(b0++); }
    while (a0 < a1 && b0 < b1 && a[a1 - 1] === b[b1 - 1]) { ra.push(--a1); rb.push(--b1); }
    if (a0 >= a1 || b0 >= b1) continue;
    // patience: ids that occur once on each side are anchors; their longest in-order run is kept
    const seen = new Map<number, [number, number, number, number]>(); // id → [count a, at a, count b, at b]
    for (let i = a0; i < a1; i++) { const s = seen.get(a[i]!); if (s) s[0]++; else seen.set(a[i]!, [1, i, 0, -1]); }
    for (let j = b0; j < b1; j++) { const s = seen.get(b[j]!); if (s) { s[2]++; s[3] = j; } }
    const cand: [number, number][] = [];
    for (const s of seen.values()) if (s[0] === 1 && s[2] === 1) cand.push([s[1], s[3]]);
    if (cand.length) {
      const kept = inOrder(cand.map((c) => c[0]), cand.map((c) => c[1]));
      const keep = [...kept].sort((x, y) => cand[x]![0] - cand[y]![0]);
      let pa = a0, pb = b0;
      for (const i of keep) {
        const [ia, ib] = cand[i]!;
        stack.push([pa, ia, pb, ib]);
        ra.push(ia); rb.push(ib);
        pa = ia + 1; pb = ib + 1;
      }
      stack.push([pa, a1, pb, b1]);
      continue;
    }
    myers(a, a0, a1, b, b0, b1, cap, ra, rb); // past the cap the gap stays unmatched
  }
  const order = ra.map((_, i) => i).sort((x, y) => ra[x]! - ra[y]!);
  return { a: order.map((i) => ra[i]!), b: order.map((i) => rb[i]!) };
}
