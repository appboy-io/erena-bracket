import { describe, it, expect } from 'vitest';
import { generateSingleElimination, reportMatchResult } from './single-elimination.js';
function createParticipants(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `player_${i + 1}`,
        seed: i + 1,
        name: `Player ${i + 1}`,
    }));
}
function getR1Matches(b) {
    return b.matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position);
}
function assertValidStructure(b, n) {
    // Total match records = N - 1
    expect(b.matches.length).toBe(n - 1);
    // All nextMatchIds point to existing matches (or null for the final).
    const matchIds = new Set(b.matches.map(m => m.id));
    for (const m of b.matches) {
        if (m.nextMatchId !== null) {
            expect(matchIds.has(m.nextMatchId)).toBe(true);
        }
    }
    // Exactly one match has no nextMatchId (the final).
    const finals = b.matches.filter(m => m.nextMatchId === null);
    expect(finals.length).toBe(1);
    // No participant appears in two R1 slots.
    const r1Slots = [];
    for (const m of getR1Matches(b)) {
        if (m.participant1)
            r1Slots.push(m.participant1);
        if (m.participant2)
            r1Slots.push(m.participant2);
    }
    const r1SlotSet = new Set(r1Slots);
    expect(r1SlotSet.size).toBe(r1Slots.length);
    // Walk the advancement graph from every match to confirm we reach the final.
    for (const start of b.matches) {
        let cur = start;
        let steps = 0;
        while (cur && cur.nextMatchId) {
            const next = b.matches.find(m => m.id === cur.nextMatchId);
            expect(next).toBeDefined();
            cur = next;
            steps++;
            if (steps > b.matches.length)
                throw new Error('infinite loop in advancement graph');
        }
        expect(cur).toBeDefined();
        expect(cur.nextMatchId).toBeNull(); // landed at the final
    }
}
describe('generateSingleElimination — error handling', () => {
    it('throws error for less than 2 participants', () => {
        expect(() => generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(1),
        })).toThrow('Need at least 2 participants');
    });
});
describe('generateSingleElimination — N=2 (trivial)', () => {
    it('produces 1 match, 0 byes', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(2),
        });
        expect(b.matches.length).toBe(1);
        expect(b.totalRounds).toBe(1);
        const m = b.matches[0];
        expect(m.participant1).toBe('player_1');
        expect(m.participant2).toBe('player_2');
        expect(m.status).toBe('ready');
        expect(m.nextMatchId).toBeNull();
        assertValidStructure(b, 2);
    });
});
describe('generateSingleElimination — N=3 (one R1 bye)', () => {
    it('produces 2 matches with seed 1 pre-placed in R2', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(3),
        });
        expect(b.matches.length).toBe(2);
        expect(b.totalRounds).toBe(2);
        const r1 = getR1Matches(b);
        expect(r1.length).toBe(1);
        // R1 match should contain seeds 2 and 3
        const seeds = [r1[0].participant1Seed, r1[0].participant2Seed].sort();
        expect(seeds).toEqual([2, 3]);
        const r2 = b.matches.find(m => m.round === 2);
        // Seed 1 should be pre-placed in R2 (slot 1, top).
        expect(r2.participant1).toBe('player_1');
        expect(r2.participant1Seed).toBe(1);
        expect(r2.participant2).toBeNull();
        expect(r2.status).toBe('pending');
        // R1M1 links to R2 slot 2.
        expect(r1[0].nextMatchId).toBe(r2.id);
        expect(r1[0].nextMatchSlot).toBe(2);
        assertValidStructure(b, 3);
    });
});
describe('generateSingleElimination — N=4 (power of 2, no byes)', () => {
    it('produces 3 matches with standard SE pairings', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(4),
        });
        expect(b.matches.length).toBe(3);
        expect(b.totalRounds).toBe(2);
        const r1 = getR1Matches(b);
        expect(r1.length).toBe(2);
        // Standard pairings: 1v4, 2v3
        expect(r1[0].participant1Seed).toBe(1);
        expect(r1[0].participant2Seed).toBe(4);
        expect(r1[1].participant1Seed).toBe(2);
        expect(r1[1].participant2Seed).toBe(3);
        const finals = b.matches.find(m => m.round === 2);
        expect(finals.participant1).toBeNull();
        expect(finals.participant2).toBeNull();
        expect(finals.nextMatchId).toBeNull();
        assertValidStructure(b, 4);
    });
});
describe('generateSingleElimination — N=5 (byes in R1 and R2)', () => {
    it('produces 4 matches with seed 1 R1-byed and a R2 bye routing', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(5),
        });
        expect(b.matches.length).toBe(4);
        expect(b.totalRounds).toBe(3);
        // Round counts [2,1,1]: R1=2 matches, R2=1 match, R3=1 match (final).
        expect(b.matches.filter(m => m.round === 1).length).toBe(2);
        expect(b.matches.filter(m => m.round === 2).length).toBe(1);
        expect(b.matches.filter(m => m.round === 3).length).toBe(1);
        // Seed 1 is pre-placed in R2 (R1 bye, top).
        const r2 = b.matches.find(m => m.round === 2);
        expect(r2.participant1).toBe('player_1');
        expect(r2.participant1Seed).toBe(1);
        expect(r2.participant2).toBeNull();
        // R1 byes are at top (round 1 = odd) → seed 1.
        // R2 byes are at bottom (round 2 = even) → R1M2's winner routes past R2
        // to the R3 final slot 2 (the bottom slot).
        const r1 = getR1Matches(b);
        expect(r1[0].nextMatchId).toBe(r2.id);
        expect(r1[0].nextMatchSlot).toBe(2);
        const final = b.matches.find(m => m.round === 3);
        expect(r1[1].nextMatchId).toBe(final.id);
        expect(r1[1].nextMatchSlot).toBe(2);
        expect(r2.nextMatchId).toBe(final.id);
        expect(r2.nextMatchSlot).toBe(1);
        assertValidStructure(b, 5);
    });
});
describe('generateSingleElimination — N=6 (one bye in R2 only)', () => {
    it('produces 5 matches with no R1 bye', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(6),
        });
        expect(b.matches.length).toBe(5);
        expect(b.totalRounds).toBe(3);
        // Round counts [3, 1, 1]: R1=3, R2=1, R3=1
        expect(b.matches.filter(m => m.round === 1).length).toBe(3);
        expect(b.matches.filter(m => m.round === 2).length).toBe(1);
        expect(b.matches.filter(m => m.round === 3).length).toBe(1);
        // No R1 bye — all 6 seeds play in R1.
        const r1 = getR1Matches(b);
        const allR1Seeds = r1.flatMap(m => [m.participant1Seed, m.participant2Seed]);
        expect(allR1Seeds.filter(s => s !== null).length).toBe(6);
        assertValidStructure(b, 6);
    });
});
describe('generateSingleElimination — N=7 (one bye in R1 only)', () => {
    it('produces 6 matches', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(7),
        });
        expect(b.matches.length).toBe(6);
        expect(b.totalRounds).toBe(3);
        // Round counts [3, 2, 1]
        expect(b.matches.filter(m => m.round === 1).length).toBe(3);
        expect(b.matches.filter(m => m.round === 2).length).toBe(2);
        expect(b.matches.filter(m => m.round === 3).length).toBe(1);
        // Seed 1 byes R1 — pre-placed in R2.
        const r2Matches = b.matches.filter(m => m.round === 2);
        const seed1InR2 = r2Matches.some(m => m.participant1Seed === 1 || m.participant2Seed === 1);
        expect(seed1InR2).toBe(true);
        assertValidStructure(b, 7);
    });
});
describe('generateSingleElimination — N=8 (power of 2)', () => {
    it('produces 7 matches with standard pairings and zero byes', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(8),
        });
        expect(b.matches.length).toBe(7);
        expect(b.totalRounds).toBe(3);
        const r1 = getR1Matches(b);
        expect(r1.length).toBe(4);
        // Standard pairings: 1v8, 4v5, 2v7, 3v6
        expect(r1[0].participant1Seed).toBe(1);
        expect(r1[0].participant2Seed).toBe(8);
        expect(r1[1].participant1Seed).toBe(4);
        expect(r1[1].participant2Seed).toBe(5);
        expect(r1[2].participant1Seed).toBe(2);
        expect(r1[2].participant2Seed).toBe(7);
        expect(r1[3].participant1Seed).toBe(3);
        expect(r1[3].participant2Seed).toBe(6);
        assertValidStructure(b, 8);
    });
});
describe('generateSingleElimination — N=13 (canonical flow-bye example)', () => {
    it('produces 12 matches with [6,3,2,1] per-round counts', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(13),
        });
        expect(b.matches.length).toBe(12);
        expect(b.totalRounds).toBe(4);
        expect(b.matches.filter(m => m.round === 1).length).toBe(6);
        expect(b.matches.filter(m => m.round === 2).length).toBe(3);
        expect(b.matches.filter(m => m.round === 3).length).toBe(2);
        expect(b.matches.filter(m => m.round === 4).length).toBe(1);
        // Seed 1 R1-byes — pre-placed at top of R2.
        const r2 = b.matches.filter(m => m.round === 2).sort((a, b) => a.position - b.position);
        expect(r2[0].participant1Seed).toBe(1);
        expect(r2[0].participant2).toBeNull();
        // One R1 match should route past R2 directly into R3 (the R2 bye routing,
        // placed at the BOTTOM of R2 since round 2 is even).
        const r1 = getR1Matches(b);
        const skippingR2 = r1.filter(m => {
            if (!m.nextMatchId)
                return false;
            const target = b.matches.find(x => x.id === m.nextMatchId);
            return target?.round === 3;
        });
        expect(skippingR2.length).toBe(1);
        // It should be the bottom-most R1 match.
        expect(skippingR2[0].position).toBe(6);
        // And it should land in the bottom-half of R3.
        const r3 = b.matches.filter(m => m.round === 3).sort((a, b) => a.position - b.position);
        const skipTarget = b.matches.find(x => x.id === skippingR2[0].nextMatchId);
        expect(skipTarget.id).toBe(r3[1].id);
        expect(skippingR2[0].nextMatchSlot).toBe(2);
        assertValidStructure(b, 13);
    });
});
describe('generateSingleElimination — N=16 (power of 2)', () => {
    it('produces 15 matches with zero byes', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(16),
        });
        expect(b.matches.length).toBe(15);
        expect(b.totalRounds).toBe(4);
        expect(b.matches.filter(m => m.round === 1).length).toBe(8);
        expect(b.matches.filter(m => m.round === 2).length).toBe(4);
        expect(b.matches.filter(m => m.round === 3).length).toBe(2);
        expect(b.matches.filter(m => m.round === 4).length).toBe(1);
        // Every R1 match has both participants filled.
        const r1 = getR1Matches(b);
        for (const m of r1) {
            expect(m.participant1).not.toBeNull();
            expect(m.participant2).not.toBeNull();
        }
        // R1M1: seeds 1 vs 16
        expect(r1[0].participant1Seed).toBe(1);
        expect(r1[0].participant2Seed).toBe(16);
        assertValidStructure(b, 16);
    });
});
describe('generateSingleElimination — N=17 (4 byes total)', () => {
    it('produces 16 matches with [8,4,2,1,1] per-round counts', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(17),
        });
        expect(b.matches.length).toBe(16);
        expect(b.totalRounds).toBe(5);
        expect(b.matches.filter(m => m.round === 1).length).toBe(8);
        expect(b.matches.filter(m => m.round === 2).length).toBe(4);
        expect(b.matches.filter(m => m.round === 3).length).toBe(2);
        expect(b.matches.filter(m => m.round === 4).length).toBe(1);
        expect(b.matches.filter(m => m.round === 5).length).toBe(1);
        // Seed 1 R1-byes (R1 odd → top): pre-placed in top R2 match.
        const r2 = b.matches.filter(m => m.round === 2).sort((a, b) => a.position - b.position);
        expect(r2[0].participant1Seed).toBe(1);
        assertValidStructure(b, 17);
    });
});
describe('generateSingleElimination — round-count totals match N-1 for many N', () => {
    it('passes for various participant counts', () => {
        for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 16, 17, 23, 32, 33]) {
            const b = generateSingleElimination({
                tournamentId: 't',
                participants: createParticipants(n),
            });
            expect(b.matches.length).toBe(n - 1);
            assertValidStructure(b, n);
        }
    });
});
describe('generateSingleElimination — top seeds occupy expected positions', () => {
    it('places seed 1 in the top R1 entry slot', () => {
        // For any N, seed 1 should occupy the top-most R1 entry: either the R1
        // bye-slot (if N odd) or R1M1.slot1 (if N even).
        for (const n of [2, 3, 4, 5, 6, 7, 8, 13, 16, 17]) {
            const b = generateSingleElimination({
                tournamentId: 't',
                participants: createParticipants(n),
            });
            const r1Matches = b.matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position);
            if (n % 2 === 0) {
                // No R1 bye: seed 1 in R1M1.slot1
                expect(r1Matches[0].participant1Seed).toBe(1);
            }
            else {
                // R1 bye: seed 1 should NOT be in any R1 match
                for (const m of r1Matches) {
                    expect(m.participant1Seed).not.toBe(1);
                    expect(m.participant2Seed).not.toBe(1);
                }
                // Seed 1 should be pre-placed in the top R2 match.
                const r2Matches = b.matches.filter(m => m.round === 2).sort((a, b) => a.position - b.position);
                expect(r2Matches[0].participant1Seed).toBe(1);
            }
        }
    });
});
describe('reportMatchResult', () => {
    it('throws error for invalid match', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(4),
        });
        expect(() => reportMatchResult(b, 'invalid', 'player_1')).toThrow('not found');
    });
    it('throws error for invalid winner', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(4),
        });
        const r1m1 = b.matches.find(m => m.round === 1 && m.position === 1);
        expect(() => reportMatchResult(b, r1m1.id, 'invalid_player')).toThrow('not a participant');
    });
    it('advances winner to next match', () => {
        const b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(4),
        });
        const r1m1 = b.matches.find(m => m.round === 1 && m.position === 1);
        const updated = reportMatchResult(b, r1m1.id, 'player_1');
        const completed = updated.matches.find(m => m.id === r1m1.id);
        expect(completed.winner).toBe('player_1');
        expect(completed.status).toBe('completed');
        const finals = updated.matches.find(m => m.round === 2);
        expect(finals.participant1).toBe('player_1');
    });
    it('simulates a full 4-player tournament', () => {
        let b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(4),
        });
        const r1m1 = b.matches.find(m => m.round === 1 && m.position === 1);
        b = reportMatchResult(b, r1m1.id, 'player_1');
        const r1m2 = b.matches.find(m => m.round === 1 && m.position === 2);
        b = reportMatchResult(b, r1m2.id, 'player_2');
        const finals = b.matches.find(m => m.round === 2);
        expect(finals.status).toBe('ready');
        expect(finals.participant1).toBe('player_1');
        expect(finals.participant2).toBe('player_2');
        b = reportMatchResult(b, finals.id, 'player_1');
        const done = b.matches.find(m => m.round === 2);
        expect(done.winner).toBe('player_1');
        expect(done.status).toBe('completed');
    });
    it('simulates a full 5-player tournament with byes', () => {
        let b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(5),
        });
        // Round counts: R1=2, R2=1, R3=1
        // Seed 1 byes R1 → R2.slot1. R1M2 winner byes R2 → R3.slot2.
        const r1 = b.matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position);
        // Play R1M1 — winner goes to R2 slot 2
        b = reportMatchResult(b, r1[0].id, r1[0].participant1);
        // Play R1M2 — winner routes past R2 to R3 slot 2
        b = reportMatchResult(b, r1[1].id, r1[1].participant1);
        const r2 = b.matches.find(m => m.round === 2);
        expect(r2.status).toBe('ready');
        expect(r2.participant1).toBe('player_1');
        expect(r2.participant2).toBe(r1[0].participant1);
        const r3 = b.matches.find(m => m.round === 3);
        expect(r3.participant2).toBe(r1[1].participant1);
        b = reportMatchResult(b, r2.id, 'player_1');
        const r3After = b.matches.find(m => m.round === 3);
        expect(r3After.participant1).toBe('player_1');
        expect(r3After.status).toBe('ready');
        b = reportMatchResult(b, r3After.id, 'player_1');
        const finals = b.matches.find(m => m.round === 3);
        expect(finals.winner).toBe('player_1');
        expect(finals.status).toBe('completed');
    });
    it('simulates a full 13-player tournament', () => {
        let b = generateSingleElimination({
            tournamentId: 't',
            participants: createParticipants(13),
        });
        // Play every R1 match, then every R2 match, etc. Always advance lowest
        // seed (the favorite). At the end seed 1 should be the champion.
        for (let round = 1; round <= b.totalRounds; round++) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const ready = b.matches.find(m => m.round === round && m.status === 'ready');
                if (!ready)
                    break;
                const winnerId = (ready.participant1Seed ?? Infinity) <= (ready.participant2Seed ?? Infinity)
                    ? ready.participant1
                    : ready.participant2;
                b = reportMatchResult(b, ready.id, winnerId);
            }
        }
        const final = b.matches.find(m => m.round === b.totalRounds);
        expect(final.status).toBe('completed');
        expect(final.winner).toBe('player_1');
    });
});
//# sourceMappingURL=single-elimination.test.js.map