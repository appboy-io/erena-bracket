import { describe, it, expect } from 'vitest';
import { generateDoubleElimination, reportDoubleElimMatchResult } from './double-elimination.js';
function createParticipants(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `player_${i + 1}`,
        seed: i + 1,
        name: `Player ${i + 1}`,
    }));
}
describe('generateDoubleElimination', () => {
    it('throws error for less than 2 participants', () => {
        expect(() => generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(1),
        })).toThrow('Need at least 2 participants');
    });
    it('generates correct bracket for 4 participants', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        expect(bracket.format).toBe('double_elim');
        // Winners bracket: 2 R1 + 1 R2 = 3 matches
        const winnersMatches = bracket.matches.filter(m => m.bracketType === 'winners');
        expect(winnersMatches.length).toBe(3);
        // Losers bracket: (2-1) * 2 = 2 rounds
        const losersMatches = bracket.matches.filter(m => m.bracketType === 'losers');
        expect(losersMatches.length).toBeGreaterThan(0);
        // Grand finals: 2 matches (with reset)
        const grandFinals = bracket.matches.filter(m => m.bracketType === 'grand_final');
        expect(grandFinals.length).toBe(2);
    });
    it('generates correct bracket for 8 participants', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(8),
        });
        // Winners bracket: 4 R1 + 2 R2 + 1 R3 = 7 matches
        const winnersMatches = bracket.matches.filter(m => m.bracketType === 'winners');
        expect(winnersMatches.length).toBe(7);
        // Losers bracket rounds: (3-1) * 2 = 4 rounds
        const losersMatches = bracket.matches.filter(m => m.bracketType === 'losers');
        expect(losersMatches.length).toBeGreaterThan(0);
        // Grand finals: 2 matches
        const grandFinals = bracket.matches.filter(m => m.bracketType === 'grand_final');
        expect(grandFinals.length).toBe(2);
    });
    it('sets up winners bracket seeding correctly', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(8),
        });
        const winnersR1 = bracket.matches.filter(m => m.bracketType === 'winners' && m.round === 1);
        // Check 1v8 matchup
        const m1 = winnersR1.find(m => m.position === 1);
        expect(m1.participant1Seed).toBe(1);
        expect(m1.participant2Seed).toBe(8);
    });
    it('links winners losers to losers bracket', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const winnersR1 = bracket.matches.filter(m => m.bracketType === 'winners' && m.round === 1);
        // Each winners match should have a loserNextMatchId
        for (const match of winnersR1) {
            expect(match.loserNextMatchId).not.toBeNull();
        }
    });
    it('links winners finals to grand finals', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const winnersFinals = bracket.matches.find(m => m.bracketType === 'winners' && m.round === 2);
        const grandFinals1 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1);
        expect(winnersFinals.nextMatchId).toBe(grandFinals1.id);
        expect(winnersFinals.nextMatchSlot).toBe(1);
    });
    it('can disable grand finals reset', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
            grandFinalReset: false,
        });
        const grandFinals = bracket.matches.filter(m => m.bracketType === 'grand_final');
        expect(grandFinals.length).toBe(1);
    });
});
describe('reportDoubleElimMatchResult', () => {
    it('advances winner in winners bracket', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const match = bracket.matches.find(m => m.bracketType === 'winners' && m.round === 1 && m.position === 1);
        const updated = reportDoubleElimMatchResult(bracket, match.id, 'player_1');
        const completedMatch = updated.matches.find(m => m.id === match.id);
        expect(completedMatch.winner).toBe('player_1');
        expect(completedMatch.status).toBe('completed');
        // Winner should advance to winners R2
        const winnersR2 = updated.matches.find(m => m.bracketType === 'winners' && m.round === 2);
        expect(winnersR2.participant1).toBe('player_1');
    });
    it('sends loser to losers bracket', () => {
        const bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const match = bracket.matches.find(m => m.bracketType === 'winners' && m.round === 1 && m.position === 1);
        // player_1 wins, player_4 loses
        const updated = reportDoubleElimMatchResult(bracket, match.id, 'player_1');
        // player_4 should be in losers bracket
        const losersR1 = updated.matches.filter(m => m.bracketType === 'losers' && m.round === 1);
        const hasPlayer4 = losersR1.some(m => m.participant1 === 'player_4' || m.participant2 === 'player_4');
        expect(hasPlayer4).toBe(true);
    });
    it('handles grand finals - winners bracket player wins', () => {
        let bracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        // Simulate tournament to get to grand finals
        // This is a simplified test - in reality we'd play through all matches
        // Find grand finals match 1
        const gf1 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1);
        // Manually set up grand finals for testing
        const matches = bracket.matches.map(m => {
            if (m.id === gf1.id) {
                return {
                    ...m,
                    participant1: 'player_1', // Winners bracket winner
                    participant1Seed: 1,
                    participant2: 'player_2', // Losers bracket winner
                    participant2Seed: 2,
                    status: 'ready',
                };
            }
            return m;
        });
        bracket = { ...bracket, matches };
        // Winners bracket player wins GF1
        const updated = reportDoubleElimMatchResult(bracket, gf1.id, 'player_1');
        const completedGF1 = updated.matches.find(m => m.id === gf1.id);
        expect(completedGF1.winner).toBe('player_1');
        // GF2 should be marked as bye (not needed)
        const gf2 = updated.matches.find(m => m.bracketType === 'grand_final' && m.round === 2);
        expect(gf2.status).toBe('bye');
    });
    it('handles grand finals reset - losers bracket player wins GF1', () => {
        const initialBracket = generateDoubleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const gf1 = initialBracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1);
        // Set up grand finals by creating new match objects
        const matches = initialBracket.matches.map(m => {
            if (m.id === gf1.id) {
                return {
                    ...m,
                    participant1: 'player_1', // Winners bracket winner
                    participant1Seed: 1,
                    participant2: 'player_2', // Losers bracket winner
                    participant2Seed: 2,
                    status: 'ready',
                };
            }
            return { ...m };
        });
        const bracket = { ...initialBracket, matches };
        // Losers bracket player (participant2 = player_2) wins GF1 - reset needed
        const updated = reportDoubleElimMatchResult(bracket, gf1.id, 'player_2');
        // GF2 should be ready with both players
        const gf2 = updated.matches.find(m => m.bracketType === 'grand_final' && m.round === 2);
        expect(gf2.status).toBe('ready');
        expect(gf2.participant1).toBe('player_1'); // Original WB winner
        expect(gf2.participant2).toBe('player_2'); // GF1 winner
    });
});
// Winners-bracket match IDs that can reach (matchId, slot) by any feed path.
// Independent re-implementation used only to verify the library's output.
function winnersAncestry(matches, matchId, slot) {
    const acc = new Set();
    const feeders = matches.filter((m) => (m.nextMatchId === matchId && m.nextMatchSlot === slot) ||
        (m.loserNextMatchId === matchId && m.loserNextMatchSlot === slot));
    for (const f of feeders) {
        if (f.bracketType === 'winners') {
            acc.add(f.id);
        }
        else {
            for (const s of [1, 2]) {
                for (const id of winnersAncestry(matches, f.id, s))
                    acc.add(id);
            }
        }
    }
    return acc;
}
// Deterministic PRNG so simulated tournaments are reproducible.
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Play a full random tournament and return the earliest losers-bracket round in
// which two players who already met in the winners bracket are paired again
// (Infinity if it never happens). This is the real correctness oracle: a correct
// crossover pushes any such rematch to the latest round the structure allows.
function earliestWinnersRematchInLosers(bracket, seed) {
    let b = { ...bracket, matches: bracket.matches.map((m) => ({ ...m })) };
    const rnd = mulberry32(seed);
    const met = {};
    for (let guard = 0; guard < 5000; guard++) {
        const playable = b.matches.filter((m) => m.participant1 && m.participant2 && m.status !== 'completed' && m.status !== 'bye');
        if (playable.length === 0)
            break;
        const m = playable[0];
        const key = [m.participant1, m.participant2].sort().join('|');
        (met[key] = met[key] || []).push({ bt: m.bracketType, round: m.round });
        b = reportDoubleElimMatchResult(b, m.id, rnd() < 0.5 ? m.participant1 : m.participant2);
    }
    let earliest = Infinity;
    for (const list of Object.values(met)) {
        if (list.length < 2 || !list.some((x) => x.bt === 'winners'))
            continue;
        for (const l of list.filter((x) => x.bt === 'losers'))
            earliest = Math.min(earliest, l.round);
    }
    return earliest;
}
describe('losers bracket rematch avoidance', () => {
    // Two players who met in winners can only be *forced* to meet again in the losers
    // bracket at round log2(bracketSize) at the earliest (start.gg-optimal). Assert no
    // random tournament produces a rematch before that floor — for power-of-two sizes...
    it.each([
        [4, 4],
        [8, 8],
        [16, 16],
        [32, 32],
        [64, 64],
    ])('players=%i: no losers rematch before the LR%i floor', (n, bracketSize) => {
        const floor = Math.log2(bracketSize);
        const bracket = generateDoubleElimination({ tournamentId: 'test', participants: createParticipants(n) });
        let minRound = Infinity;
        for (let seed = 1; seed <= 200; seed++) {
            minRound = Math.min(minRound, earliestWinnersRematchInLosers(bracket, seed));
        }
        expect(minRound, `earliest losers rematch LR${minRound} < floor LR${floor}`).toBeGreaterThanOrEqual(floor);
    });
    // ...and for odd/bye brackets (players not a power of two), which must respect the
    // same floor for their padded bracket size.
    it.each([
        [6, 8],
        [12, 16],
        [17, 32],
        [24, 32],
    ])('byes: players=%i respect the LR%i floor', (n, bracketSize) => {
        const floor = Math.log2(bracketSize);
        const bracket = generateDoubleElimination({ tournamentId: 'test', participants: createParticipants(n) });
        let minRound = Infinity;
        for (let seed = 1; seed <= 200; seed++) {
            minRound = Math.min(minRound, earliestWinnersRematchInLosers(bracket, seed));
        }
        expect(minRound, `earliest losers rematch LR${minRound} < floor LR${floor}`).toBeGreaterThanOrEqual(floor);
    });
    // The reported g-league case: a WR2 loser must not land immediately against a player
    // from its own WR1 match (the original double jeopardy).
    it('g-league regression: WR2 loser not immediately re-paired against its own WR1 opponent', () => {
        const bracket = generateDoubleElimination({ tournamentId: 'test', participants: createParticipants(16) });
        const wr2m1 = bracket.matches.find((m) => m.bracketType === 'winners' && m.round === 2 && m.position === 1);
        const sitting = winnersAncestry(bracket.matches, wr2m1.loserNextMatchId, 1);
        const clash = [...sitting].filter((id) => id === 'test_WR1M1' || id === 'test_WR1M2');
        expect(clash, `WR2M1 loser drops immediately against ${clash.join(',')}`).toEqual([]);
    });
});
// Plays every 'ready' match (participant1 always wins) until none remain.
function playOut(bracket) {
    let current = bracket;
    let guard = 0;
    while (guard++ < 1000) {
        const ready = current.matches.find(m => m.status === 'ready' && m.participant1 && m.participant2 && !m.winner);
        if (!ready)
            break;
        current = reportDoubleElimMatchResult(current, ready.id, ready.participant1);
    }
    return current;
}
describe('byes flow through the losers bracket', () => {
    for (const count of [10, 12]) {
        it(`completes a ${count}-player double-elim without deadlocking`, () => {
            const bracket = playOut(generateDoubleElimination({ tournamentId: 't', participants: createParticipants(count) }));
            const gf1 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1);
            const gf2 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 2);
            expect(gf1?.winner, 'grand final never resolved → losers bracket deadlocked').toBeTruthy();
            expect(gf2?.status === 'bye' || gf2?.status === 'completed').toBe(true);
            const stuck = bracket.matches.filter(m => m.bracketType === 'losers' && m.status !== 'completed' && m.status !== 'bye'
                && ((!!m.participant1) !== (!!m.participant2)));
            expect(stuck, `stuck losers matches: ${stuck.map(s => s.id).join(', ')}`).toHaveLength(0);
        });
    }
});
//# sourceMappingURL=double-elimination.test.js.map