#!/usr/bin/env node
/**
 * Losers-bracket crossover search.
 *
 *   node scripts/crossover-search.mjs validate
 *       Reproduce the slack vectors of the shipped and the old alternating plans.
 *       Run this FIRST after touching the model — every number below depends on it.
 *
 *   node scripts/crossover-search.mjs exhaustive <k>
 *       Every seat permutation for a 2^k bracket. Tractable to k=5 (1,935,360).
 *
 *   node scripts/crossover-search.mjs refine <k> <perm,perm,...>
 *       Score a named plan, then try every 1- and 2-swap neighbour of it.
 *       This is the useful test above k=5 — see the warning in docs/losers-crossover.md
 *       about random-restart hill climbing, which is worse than useless there.
 *
 *   node scripts/crossover-search.mjs climb <k> [restarts]
 *       Random-restart hill climbing. KEPT ONLY AS A CAUTIONARY TOOL: at k>=6 it
 *       returns arrangements WORSE than the shipped plan. Do not trust it alone.
 *
 * See docs/losers-crossover.md for the results and what they do and do not prove.
 */

/**
 * Exhaustive search over ALL seat permutations for the winners->losers drop.
 *
 * Model (verified against erena-bracket's generated pointers):
 *   LR1[p]      slot1 = loser WR1[2p-1], slot2 = loser WR1[2p]
 *   LR even lr  slot1 = winner LR[lr-1][p],      slot2 = loser WR[lr/2+1][perm(p)]
 *   LR odd  lr  slot1 = winner LR[lr-1][2p-1],   slot2 = winner LR[lr-1][2p]
 *
 * "Which winners matches could the player arriving in this slot already have
 * played?" is a set over WB matches, so it is a bitmask. A rematch is possible in
 * a losers match iff its two slot masks intersect: some WB match X could have sent
 * one of its two players down each side.
 *
 * The winner of a losers match carries the UNION of its two slots — the winner is
 * one of the two, and either is reachable in some play-out.
 */

function build(k) {
  const bs = 1 << k;
  // ---- index every winners match, and precompute its "played" mask ----
  const wbIndex = new Map();          // "r:p" -> bit index
  const wbRound = [];                 // bit index -> round
  let n = 0;
  for (let r = 1; r <= k; r++)
    for (let p = 1; p <= bs >> r; p++) { wbIndex.set(`${r}:${p}`, n); wbRound.push(r); n++; }

  // played[r][p] = mask of WB matches a player leaving WR r match p has contested
  const played = [];
  for (let r = 1; r <= k; r++) {
    played[r] = [];
    for (let p = 1; p <= bs >> r; p++) {
      let m = 1n << BigInt(wbIndex.get(`${r}:${p}`));
      if (r > 1) m |= played[r - 1][2 * p - 1] | played[r - 1][2 * p];
      played[r][p] = m;
    }
  }

  const lrRounds = 2 * (k - 1);
  const lrCount = (lr) => (bs / 4) >> Math.floor((lr - 1) / 2);
  return { bs, k, n, wbRound, played, lrRounds, lrCount };
}

/** slack[r-1] = earliest losers round a WR-r pair can meet, minus its structural floor. */
function evaluate(B, perms) {
  const { k, wbRound, played, lrRounds, lrCount } = B;
  const earliest = new Array(k + 1).fill(Infinity);
  let prevWinner = null;                       // winner mask per position of LR(lr-1)

  for (let lr = 1; lr <= lrRounds; lr++) {
    const count = lrCount(lr);
    const s1 = new Array(count + 1), s2 = new Array(count + 1), win = new Array(count + 1);
    for (let p = 1; p <= count; p++) {
      if (lr === 1) {
        s1[p] = played[1][2 * p - 1];
        s2[p] = played[1][2 * p];
      } else if (lr % 2 === 0) {
        const wRound = lr / 2 + 1;
        s1[p] = prevWinner[p];
        s2[p] = played[wRound][perms[wRound][p - 1]];   // perm: seat p <- dropper index
      } else {
        s1[p] = prevWinner[2 * p - 1];
        s2[p] = prevWinner[2 * p];
      }
      const clash = s1[p] & s2[p];
      if (clash) {
        // record the earliest losers round for every winners round implicated
        let bits = clash, i = 0;
        while (bits) {
          if (bits & 1n) { const r = wbRound[i]; if (lr < earliest[r]) earliest[r] = lr; }
          bits >>= 1n; i++;
        }
      }
      win[p] = s1[p] | s2[p];
    }
    prevWinner = win;
  }

  const slack = [];
  for (let r = 1; r <= k - 1; r++) {
    const e = earliest[r];
    slack.push(e === Infinity ? 99 : e - (r === 1 ? 2 : 2 * r));
  }
  return slack;
}

/** Lexicographic: earlier winners rounds matter most. */
function better(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function* permutations(arr) {
  if (arr.length <= 1) { yield arr.slice(); return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

// ---- the shipped plan's permutations, for validation and refinement ----
function namedSeats(name, c) {
  // shipped code maps dropper pos -> seat index; invert it into seat -> dropper
  const seatOf = [];
  for (let pos = 1; pos <= c; pos++) {
    let idx;
    if (name === 'identity') idx = pos - 1;
    else if (name === 'reverse') idx = c - pos;
    else if (name === 'halfswap') { const h = c / 2; idx = (pos <= h ? pos + h : pos - h) - 1; }
    else { const h = c / 2; idx = c - (pos <= h ? pos + h : pos - h); }
    seatOf[idx] = pos;
  }
  return seatOf; // seatOf[seatIndex] = dropper position
}

function permsFromNames(B, names) {
  const out = {};
  for (let wRound = 2; wRound <= B.k - 1; wRound++) {
    const c = B.bs >> wRound;
    out[wRound] = namedSeats(names[wRound - 2], c);
  }
  // the winners final loser always goes to the single last losers seat
  out[B.k] = [1];
  return out;
}

const mode = process.argv[2] || 'validate';

if (mode === 'validate') {
  for (const [k, names, label] of [
    [4, ['reverse', 'identity'], '16 shipped'],
    [4, ['reverse', 'halfswap'], '16 old'],
    [5, ['reverse', 'revhalf', 'reverse'], '32 shipped'],
    [5, ['reverse', 'halfswap', 'reverse'], '32 old'],
    [6, ['reverse', 'halfswap', 'revhalf', 'reverse'], '64 shipped'],
    [6, ['reverse', 'halfswap', 'reverse', 'halfswap'], '64 old'],
  ]) {
    const B = build(k);
    console.log(`  ${label.padEnd(12)} ${JSON.stringify(evaluate(B, permsFromNames(B, names)))}`);
  }
}

if (mode === 'exhaustive') {
  const k = Number(process.argv[3]);
  const B = build(k);
  const dropRounds = [];
  for (let wRound = 2; wRound <= k - 1; wRound++) dropRounds.push(wRound);
  const seatLists = dropRounds.map((wRound) => [...permutations(Array.from({ length: B.bs >> wRound }, (_, i) => i + 1))]);
  const total = seatLists.reduce((a, l) => a * l.length, 1);
  console.log(`  bracket ${B.bs}: ${dropRounds.map((w, i) => `${B.bs >> w}! `).join('x ')}= ${total.toLocaleString()} arrangements`);

  let best = null, bestPerms = null, ties = 0;
  const idx = new Array(seatLists.length).fill(0);
  const perms = { [k]: [1] };
  let done = false, seen = 0;
  while (!done) {
    for (let i = 0; i < dropRounds.length; i++) perms[dropRounds[i]] = seatLists[i][idx[i]];
    const s = evaluate(B, perms);
    seen++;
    if (best === null || better(s, best)) { best = s; bestPerms = dropRounds.map((w, i) => seatLists[i][idx[i]].slice()); ties = 1; }
    else if (JSON.stringify(s) === JSON.stringify(best)) ties++;
    let c = seatLists.length - 1;
    while (c >= 0) { if (++idx[c] < seatLists[c].length) break; idx[c] = 0; c--; }
    if (c < 0) done = true;
  }
  console.log(`  evaluated ${seen.toLocaleString()}`);
  console.log(`  BEST slack ${JSON.stringify(best)}  (${ties.toLocaleString()} arrangements tie)`);
  dropRounds.forEach((w, i) => console.log(`     WR${w} seats <- droppers [${bestPerms[i].join(',')}]`));
}

if (mode === 'climb') {
  const k = Number(process.argv[3]);
  const restarts = Number(process.argv[4] || 400);
  const B = build(k);
  const dropRounds = [];
  for (let w = 2; w <= k - 1; w++) dropRounds.push(w);
  const sizes = dropRounds.map((w) => B.bs >> w);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mk = () => dropRounds.map((_, i) => shuffle(Array.from({ length: sizes[i] }, (_, x) => x + 1)));
  const score = (cfg) => { const p = { [k]: [1] }; dropRounds.forEach((w, i) => (p[w] = cfg[i])); return evaluate(B, p); };

  let best = null, bestCfg = null, evals = 0;
  for (let r = 0; r < restarts; r++) {
    let cfg = mk(), cur = score(cfg); evals++;
    let improved = true;
    while (improved) {                              // steepest-ascent on pairwise swaps
      improved = false;
      for (let d = 0; d < cfg.length && !improved; d++)
        for (let a = 0; a < sizes[d] && !improved; a++)
          for (let b = a + 1; b < sizes[d]; b++) {
            const trial = cfg.map((x) => x.slice());
            [trial[d][a], trial[d][b]] = [trial[d][b], trial[d][a]];
            const s = score(trial); evals++;
            if (better(s, cur)) { cfg = trial; cur = s; improved = true; break; }
          }
    }
    if (best === null || better(cur, best)) { best = cur; bestCfg = cfg.map((x) => x.slice()); }
  }
  console.log(`  bracket ${B.bs}: ${restarts} restarts, ${evals.toLocaleString()} evaluations`);
  console.log(`  BEST FOUND slack ${JSON.stringify(best)}`);
  dropRounds.forEach((w, i) => console.log(`     WR${w} seats <- droppers [${bestCfg[i].join(',')}]`));
}

if (mode === 'refine') {
  // Start FROM the shipped plan and try every single- and double-swap.
  const k = Number(process.argv[3]);
  const names = process.argv[4].split(',');
  const B = build(k);
  const dropRounds = []; for (let w = 2; w <= k - 1; w++) dropRounds.push(w);
  const start = dropRounds.map((w, i) => namedSeats(names[i], B.bs >> w));
  const sizes = dropRounds.map((w) => B.bs >> w);
  const score = (cfg) => { const p = { [k]: [1] }; dropRounds.forEach((w, i) => (p[w] = cfg[i])); return evaluate(B, p); };
  const base = score(start);
  console.log(`  bracket ${B.bs} shipped = ${JSON.stringify(base)}`);

  let improvements = 0, tried = 0, bestS = base, bestCfg = null;
  // all single swaps
  for (let d = 0; d < start.length; d++)
    for (let a = 0; a < sizes[d]; a++)
      for (let b = a + 1; b < sizes[d]; b++) {
        const t = start.map((x) => x.slice());
        [t[d][a], t[d][b]] = [t[d][b], t[d][a]];
        const s = score(t); tried++;
        if (better(s, bestS)) { bestS = s; bestCfg = t; improvements++; }
      }
  // all pairs of swaps within one round (depth 2)
  for (let d = 0; d < start.length; d++)
    for (let a = 0; a < sizes[d]; a++)
      for (let b = a + 1; b < sizes[d]; b++)
        for (let c2 = 0; c2 < sizes[d]; c2++)
          for (let e = c2 + 1; e < sizes[d]; e++) {
            const t = start.map((x) => x.slice());
            [t[d][a], t[d][b]] = [t[d][b], t[d][a]];
            [t[d][c2], t[d][e]] = [t[d][e], t[d][c2]];
            const s = score(t); tried++;
            if (better(s, bestS)) { bestS = s; bestCfg = t; improvements++; }
          }
  console.log(`  tried ${tried.toLocaleString()} neighbours (all 1- and 2-swaps)`);
  if (improvements === 0) console.log(`  NO neighbour beats it -> shipped plan is a local optimum`);
  else { console.log(`  IMPROVED to ${JSON.stringify(bestS)}`); dropRounds.forEach((w, i) => console.log(`     WR${w} <- [${bestCfg[i].join(',')}]`)); }
}
