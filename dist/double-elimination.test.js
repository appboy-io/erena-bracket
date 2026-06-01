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