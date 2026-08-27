import { describe, it, expect } from 'vitest';
import { buildDoubleEliminationWithEntry, reportDoubleElimMatchResult, propagateByes } from './double-elimination.js';
const p = (n) => ({ id: `p${n}`, seed: n, name: `P${n}` });
/** Top 24 shape, but three pools failed to fill their third place. */
function withGaps() {
    const winners = Array.from({ length: 8 }, (_, i) => p(i + 1));
    const losers = Array.from({ length: 16 }, (_, i) => p(i + 9));
    losers[3] = null;
    losers[9] = null;
    losers[14] = null;
    return buildDoubleEliminationWithEntry('t', winners, losers);
}
describe('byes in the entry rounds', () => {
    it('marks a lone entrant as a bye rather than leaving them stuck', () => {
        const b = withGaps();
        const le1 = b.matches.filter((m) => m.bracketType === 'losers' && m.round === 1);
        const lone = le1.filter((m) => (!!m.participant1) !== (!!m.participant2));
        expect(lone.length).toBeGreaterThan(0);
        for (const m of lone) {
            expect(m.status, `${m.id} should be a bye`).toBe('bye');
            expect(m.winner).toBeTruthy();
        }
    });
    it('advances the bye winner into the next entry round', () => {
        const b = withGaps();
        const le1 = b.matches.filter((m) => m.bracketType === 'losers' && m.round === 1);
        for (const m of le1.filter((x) => x.status === 'bye')) {
            const next = b.matches.find((x) => x.id === m.nextMatchId);
            const seated = [next.participant1, next.participant2];
            expect(seated).toContain(m.winner);
        }
    });
    it('plays out to a champion without deadlocking', () => {
        let b = withGaps();
        for (let guard = 0; guard < 200; guard++) {
            const ready = b.matches.find((m) => m.participant1 && m.participant2 && !m.winner && m.status !== 'bye');
            if (!ready)
                break;
            b = reportDoubleElimMatchResult(b, ready.id, ready.participant1);
            const ms = b.matches.map((m) => ({ ...m }));
            propagateByes(ms);
            b = { ...b, matches: ms };
        }
        const gf = b.matches.find((m) => m.bracketType === 'grand_final' && m.round === 1);
        expect(gf.winner, 'grand final never resolved — the bracket deadlocked').toBeTruthy();
    });
});
//# sourceMappingURL=entry-byes.test.js.map