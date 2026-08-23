import { describe, it, expect } from 'vitest';
import { buildDoubleElimination, reportDoubleElimMatchResult, propagateByes } from './double-elimination.js';
import type { Participant } from './types.js';

const S = (n: number, seed: number, name: string): Participant => ({ id: name, seed, name });
const P: Record<string, Participant> = {};
for (const [nm, sd] of [['K7_Showoff',1],['p16',16],['p17',17],['p8',8],['p9',9],['jayhan07',4],
  ['p13',13],['p5',5],['p12',12],['Nitro',2],['p15',15],['p18',18],['p7',7],['p10',10],
  ['Lowry',3],['p14',14],['p0',0],['BlackVegeta',6],['p11',11]] as [string,number][]) P[nm]=S(0,sd,nm);

// Exact winners-round-1 slot arrangement read off prod tsl-1-marvel-tokon.
const SLOTS = [
  P['K7_Showoff']!, null,  P['p16']!, P['p17']!,  P['p8']!, null,     P['p9']!, null,
  P['jayhan07']!,   null,  P['p13']!, null,       P['p5']!, null,     P['p12']!, null,
  P['Nitro']!,      null,  P['p15']!, P['p18']!,  P['p7']!, null,     P['p10']!, null,
  P['Lowry']!,      null,  P['p14']!, P['p0']!,   P['BlackVegeta']!, null, P['p11']!, null,
];

// Real reported winners, in the order the TO entered them.
const WINS: [string, string][] = [
  ['WR1M10','p18'],['WR2M3','jayhan07'],['WR1M2','p17'],['WR1M14','p0'],['WR2M2','p9'],
  ['WR2M5','Nitro'],['WR2M6','p7'],['WR2M7','Lowry'],['WR2M8','BlackVegeta'],['WR2M4','p5'],['WR2M1','K7_Showoff'],
  ['WR3M1','K7_Showoff'],['WR3M3','Nitro'],['WR3M4','BlackVegeta'],['WR3M2','jayhan07'],
  ['WR4M2','Nitro'],['WR4M1','jayhan07'],['WR5M1','Nitro'],
];

describe('tsl-1-marvel-tokon replay', () => {
  it('Lowry and BlackVegeta cannot be re-paired before LR7', () => {
    let b = buildDoubleElimination('t', SLOTS);

    // Replay the winners bracket exactly as it was played (routing-independent).
    const report = (bracket: typeof b, id: string, winner: string) => {
      const next = reportDoubleElimMatchResult(bracket, id, winner);
      // The lib only propagates byes at generation time; production does it on
      // every report (backend match_byes.go). Mirror that or the walk stalls.
      const ms = next.matches.map(m => ({ ...m }));
      propagateByes(ms);
      // propagateByes fills slots but does not refresh statuses; production
      // recomputes them. Do the same so the walk cannot stall.
      for (const m of ms) {
        if (!m.winner && m.status === 'pending' && m.participant1 && m.participant2) m.status = 'ready';
      }
      return { ...next, matches: ms };
    };
    for (const [mid, winner] of WINS) b = report(b, `t_${mid}`, winner);

    // Where does each of the two land?
    const wr3m4 = b.matches.find(m => m.id === 't_WR3M4')!;
    const wr4m2 = b.matches.find(m => m.id === 't_WR4M2')!;
    console.log(`  Lowry (WR3M4 loser)       -> ${wr3m4.loserNextMatchId}`);
    console.log(`  BlackVegeta (WR4M2 loser) -> ${wr4m2.loserNextMatchId}`);

    // Now play out the losers bracket every possible way and see if the pair
    // can ever be forced together again before the losers final.
    const clashes = new Set<string>();
    const reached = new Set<string>();
    let seen = 0;
    // A player who loses in the losers bracket is out and can never clash again,
    // so those branches are dead weight.
    const isOut = (bracket: typeof b, who: string) =>
      bracket.matches.some(
        m => m.bracketType === 'losers' && m.winner && m.winner !== who &&
             (m.participant1 === who || m.participant2 === who)
      );
    const explore = (bracket: typeof b, depth: number) => {
      if (depth > 60) return;
      if (isOut(bracket, 'Lowry') || isOut(bracket, 'BlackVegeta')) return;
      seen++;
      const ready = bracket.matches.find(
        m => m.status === 'ready' && m.participant1 && m.participant2 && !m.winner
      );
      if (!ready) return;
      reached.add(`${ready.bracketType}R${ready.round}M${ready.position}`);
      const pair = [ready.participant1, ready.participant2];
      if (pair.includes('Lowry') && pair.includes('BlackVegeta')) {
        clashes.add(`${ready.bracketType}R${ready.round}M${ready.position}`);
      }
      for (const w of [ready.participant1!, ready.participant2!]) {
        explore(report(bracket, ready.id, w), depth + 1);
      }
    };
    explore(b, 0);
    console.log(`  explored ${seen} states; deepest losers round reached: LR${
      Math.max(...[...reached].filter(r=>r.startsWith('losers')).map(r=>Number(r.match(/R(\d+)/)![1])))}`);
    console.log(`  possible Lowry-vs-BlackVegeta rematches: ${[...clashes].join(', ') || 'none'}`);
    // Guard against a vacuous pass: the walk must actually find the pair meeting
    // somewhere, otherwise "no rematch before LR7" would be true by accident.
    expect([...clashes].length, 'search found no Lowry/BlackVegeta pairing at all').toBeGreaterThan(0);

    // The pair CAN still meet again — with static routing that is unavoidable
    // this deep — but not until LR7. Before the fix it was LR6, and LR6M1 is
    // where it actually happened live.
    const earliest = Math.min(
      ...[...clashes].filter(c => c.startsWith('losers')).map(c => Number(c.match(/R(\d+)/)![1]))
    );
    expect(earliest, `earliest losers rematch was LR${earliest}, want LR7+`).toBeGreaterThanOrEqual(7);
  }, 30000);
});
