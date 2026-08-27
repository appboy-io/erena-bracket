import { describe, it, expect } from 'vitest';
import { buildDoubleEliminationWithEntry, reportDoubleElimMatchResult } from './double-elimination.js';
const p = (n) => ({ id: `p${n}`, seed: n, name: `P${n}` });
/** Top 24: 8 pool winners into winners, 16 runners-up and thirds into losers. */
function top24() {
    const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
    const losers = Array.from({ length: 16 }, (_, i) => p(i + 9));
    return buildDoubleEliminationWithEntry('t', winners, losers);
}
const losersRound = (b, r) => b.matches.filter((m) => m.bracketType === 'losers' && m.round === r)
    .sort((a, c) => a.position - c.position);
describe('buildDoubleEliminationWithEntry', () => {
    it('places every direct entrant in the first entry round', () => {
        const b = top24();
        const le1 = losersRound(b, 1);
        expect(le1).toHaveLength(8);
        const seated = le1.flatMap((m) => [m.participant1, m.participant2]).filter(Boolean);
        expect(seated).toHaveLength(16);
        expect(new Set(seated).size).toBe(16);
    });
    it('leaves the winners bracket exactly as a normal one', () => {
        const b = top24();
        const wr1 = b.matches.filter((m) => m.bracketType === 'winners' && m.round === 1);
        expect(wr1).toHaveLength(4);
        const seated = wr1.flatMap((m) => [m.participant1, m.participant2]).filter(Boolean);
        expect(seated).toHaveLength(8);
    });
    it('has the round count planEntryShape predicts', () => {
        const b = top24();
        const rounds = new Set(b.matches.filter((m) => m.bracketType === 'losers').map((m) => m.round));
        // 2 entry rounds + 5 standard. The standard portion is 2W-1, not 2(W-1):
        // a normal LR1 merges AND halves (WR1's losers pair each other), whereas an
        // entry merge round only merges, so it needs its own reduce round after it.
        //   LR1 8  LR2 4 | LR3 4  LR4 2 | LR5 2  LR6 1 | LR7 1   = 22 = 24 - 1 - GF
        expect(Math.max(...rounds)).toBe(7);
    });
    it('produces exactly one elimination per player bar the champion', () => {
        const b = top24();
        const losers = b.matches.filter((m) => m.bracketType === 'losers').length;
        const gf = b.matches.filter((m) => m.bracketType === 'grand_final' && m.round === 1).length;
        expect(losers + gf).toBe(24 - 1);
    });
    it('drops winners round 1 losers into the round after the entry rounds', () => {
        const b = top24();
        const wr1 = b.matches.filter((m) => m.bracketType === 'winners' && m.round === 1);
        for (const m of wr1) {
            expect(m.loserNextMatchId).toMatch(/_LR3M\d+$/); // entry rounds are LR1, LR2
        }
    });
    it('drops the winners final loser into the last losers round', () => {
        const b = top24();
        const wf = b.matches.find((m) => m.bracketType === 'winners' && m.round === 3);
        expect(wf.loserNextMatchId).toBe('t_LR7M1');
    });
    it('gives every match except the last a forward pointer', () => {
        const b = top24();
        const dangling = b.matches.filter((m) => !m.nextMatchId && !(m.bracketType === 'grand_final' && m.round === 2));
        expect(dangling.map((m) => m.id)).toEqual([]);
    });
    it('never seats a player twice', () => {
        const b = top24();
        const seated = b.matches.flatMap((m) => [m.participant1, m.participant2]).filter(Boolean);
        expect(new Set(seated).size).toBe(seated.length);
    });
    it('refuses a null entrant when there is no entry round to give it a bye', () => {
        // e === 0 (D === B/2) is the Top-12 / 16-with-8-runners-up shape. There, LR1
        // is already the first merge round: the entrant holds slot 1 and the winners
        // round-1 dropper arrives in slot 2, so a null entrant leaves a match that
        // can never be resolved -- it is not a bye anyone can walk. Fail at build
        // time rather than hand a tournament organiser a bracket that bricks once
        // players are waiting.
        const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
        const losers = [p(20), p(21), p(22), null];
        expect(() => buildDoubleEliminationWithEntry('c', winners, losers)).toThrow(/cannot give a direct entrant a bye/i);
    });
    it('still gives a lone entrant a bye when there is an entry round', () => {
        // With entry rounds the pairing round absorbs the gap: p22 walks over.
        const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
        const losers = [p(20), p(21), p(22), null, p(24), p(25), p(26), p(27)];
        const b = buildDoubleEliminationWithEntry('c', winners, losers);
        const le1 = losersRound(b, 1);
        expect(le1).toHaveLength(4);
        const walkover = le1[1];
        expect(walkover.status).toBe('bye');
        expect(walkover.winner).toBe('p22');
        // and the walkover is already seated in the next round
        const le2 = losersRound(b, 2);
        expect(le2.flatMap((m) => [m.participant1, m.participant2])).toContain('p22');
    });
    it('refuses a shape that cannot reduce cleanly', () => {
        const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
        const losers = Array.from({ length: 6 }, (_, i) => p(i + 9));
        expect(() => buildDoubleEliminationWithEntry('t', winners, losers)).toThrow(/cannot reduce/i);
    });
});
describe('buildDoubleEliminationWithEntry — structure across shapes', () => {
    /** Every shape ENTRY_CROSSOVER_PLAN covers, plus the no-entry-round edge. */
    const shapes = [
        // [winners bracket, direct entrants, expected losers rounds]
        [8, 4, 5],
        [8, 8, 6],
        [8, 16, 7],
        [16, 16, 8],
        [16, 32, 9],
        [32, 32, 10],
    ];
    for (const [bracketSize, direct, expectedRounds] of shapes) {
        it(`${bracketSize}x${direct}: one elimination per player bar the champion`, () => {
            const winners = Array.from({ length: bracketSize }, (_, i) => p(i + 1));
            const losers = Array.from({ length: direct }, (_, i) => p(bracketSize + i + 1));
            const b = buildDoubleEliminationWithEntry('t', winners, losers);
            const losersMatches = b.matches.filter((m) => m.bracketType === 'losers');
            const gf = b.matches.filter((m) => m.bracketType === 'grand_final' && m.round === 1);
            expect(losersMatches.length + gf.length).toBe(bracketSize + direct - 1);
            const rounds = new Set(losersMatches.map((m) => m.round));
            expect(Math.max(...rounds)).toBe(expectedRounds);
            // no gaps: every round from 1..max exists
            expect(rounds.size).toBe(expectedRounds);
            // every losers match has both slots fillable: two feeders, or a seeded
            // entrant plus a feeder, or two seeded entrants.
            const incoming = new Map();
            for (const m of b.matches) {
                if (m.nextMatchId)
                    incoming.set(`${m.nextMatchId}#${m.nextMatchSlot}`, 1);
                if (m.loserNextMatchId)
                    incoming.set(`${m.loserNextMatchId}#${m.loserNextMatchSlot}`, 1);
            }
            for (const m of losersMatches) {
                for (const slot of [1, 2]) {
                    const seated = slot === 1 ? m.participant1 : m.participant2;
                    expect(Boolean(seated) || incoming.has(`${m.id}#${slot}`), `${m.id} slot ${slot} can never be filled`).toBe(true);
                }
            }
        });
    }
    it('seats one entrant per match when no entry round is needed', () => {
        const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
        const losers = Array.from({ length: 4 }, (_, i) => p(i + 9));
        const b = buildDoubleEliminationWithEntry('t', winners, losers);
        const le1 = losersRound(b, 1);
        expect(le1).toHaveLength(4);
        expect(le1.map((m) => m.participant1)).toEqual(['p9', 'p10', 'p11', 'p12']);
        // slot 2 of each is the winners round 1 dropper's seat
        expect(le1.every((m) => m.participant2 === null)).toBe(true);
        const wr1 = b.matches.filter((m) => m.bracketType === 'winners' && m.round === 1);
        expect(wr1.every((m) => m.loserNextMatchId?.includes('_LR1M'))).toBe(true);
    });
    it('applies the searched crossover permutation to each drop round', () => {
        const b = top24(); // 8x16 -> ['identity', 'reverse', 'identity']
        const drop = (round, position) => b.matches.find((m) => m.bracketType === 'winners' && m.round === round && m.position === position).loserNextMatchId;
        // WR1: identity — dropper i takes seat i
        expect([1, 2, 3, 4].map((i) => drop(1, i))).toEqual([
            't_LR3M1', 't_LR3M2', 't_LR3M3', 't_LR3M4',
        ]);
        // WR2: reverse — the last dropper takes the first seat
        expect([1, 2].map((i) => drop(2, i))).toEqual(['t_LR5M2', 't_LR5M1']);
        // WR3: the winners final, one seat, the losers final
        expect(drop(3, 1)).toBe('t_LR7M1');
    });
    it('plays out to a single champion with every match resolved', () => {
        let b = top24();
        // Deterministic: the higher slot always wins, so the walk is repeatable.
        let guard = 0;
        for (;;) {
            const next = b.matches.find((m) => m.status === 'ready');
            if (!next)
                break;
            if (++guard > 200)
                throw new Error('play-out did not terminate');
            b = reportDoubleElimMatchResult(b, next.id, next.participant1);
        }
        // Nothing left unresolved anywhere in the bracket.
        const unresolved = b.matches.filter((m) => m.status !== 'completed' && m.status !== 'bye');
        expect(unresolved.map((m) => m.id)).toEqual([]);
        // 23 matches were actually played (22 losers + GF1 + winners), not skipped.
        const played = b.matches.filter((m) => m.status === 'completed');
        expect(played).toHaveLength(7 + 22 + 1); // winners 7, losers 22, grand final 1
        expect(guard).toBe(30);
        // Exactly one champion, and every other player lost exactly twice or once
        // in the losers bracket.
        const gf1 = b.matches.find((m) => m.bracketType === 'grand_final' && m.round === 1);
        expect(gf1.winner).toBeTruthy();
        const eliminated = new Set(b.matches
            .filter((m) => m.bracketType !== 'winners' && m.status === 'completed')
            .map((m) => (m.participant1 === m.winner ? m.participant2 : m.participant1)));
        expect(eliminated.size).toBe(23);
        expect(eliminated.has(gf1.winner)).toBe(false);
    });
});
//# sourceMappingURL=double-elimination-entry.test.js.map