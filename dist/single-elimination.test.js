import { describe, it, expect } from 'vitest';
import { generateSingleElimination, reportMatchResult } from './single-elimination.js';
function createParticipants(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `player_${i + 1}`,
        seed: i + 1,
        name: `Player ${i + 1}`,
    }));
}
describe('generateSingleElimination', () => {
    it('throws error for less than 2 participants', () => {
        expect(() => generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(1),
        })).toThrow('Need at least 2 participants');
    });
    it('generates correct bracket for 2 participants', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(2),
        });
        expect(bracket.totalRounds).toBe(1);
        expect(bracket.matches.length).toBe(1);
        const match = bracket.matches[0];
        expect(match.participant1).toBe('player_1');
        expect(match.participant2).toBe('player_2');
        expect(match.status).toBe('ready');
    });
    it('generates correct bracket for 4 participants', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        expect(bracket.totalRounds).toBe(2);
        expect(bracket.matches.length).toBe(3); // 2 first round + 1 final
        // First round matches
        const round1 = bracket.matches.filter(m => m.round === 1);
        expect(round1.length).toBe(2);
        // Check seeding: 1v4, 2v3
        const match1 = round1.find(m => m.position === 1);
        expect(match1.participant1).toBe('player_1');
        expect(match1.participant2).toBe('player_4');
        const match2 = round1.find(m => m.position === 2);
        expect(match2.participant1).toBe('player_2');
        expect(match2.participant2).toBe('player_3');
        // Finals should be pending
        const finals = bracket.matches.find(m => m.round === 2);
        expect(finals.participant1).toBeNull();
        expect(finals.participant2).toBeNull();
        expect(finals.status).toBe('pending');
    });
    it('generates correct bracket for 8 participants', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(8),
        });
        expect(bracket.totalRounds).toBe(3);
        expect(bracket.matches.length).toBe(7); // 4 + 2 + 1
        // Check first round seeding: 1v8, 4v5, 2v7, 3v6
        const round1 = bracket.matches.filter(m => m.round === 1);
        expect(round1.length).toBe(4);
        const m1 = round1.find(m => m.position === 1);
        expect(m1.participant1Seed).toBe(1);
        expect(m1.participant2Seed).toBe(8);
        const m2 = round1.find(m => m.position === 2);
        expect(m2.participant1Seed).toBe(4);
        expect(m2.participant2Seed).toBe(5);
    });
    it('handles 6 participants with byes', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(6),
        });
        // Bracket size is 8, so 3 rounds
        expect(bracket.totalRounds).toBe(3);
        expect(bracket.matches.length).toBe(7);
        // Seeds 1 and 2 should have byes
        const round1 = bracket.matches.filter(m => m.round === 1);
        const byeMatches = round1.filter(m => m.status === 'bye');
        expect(byeMatches.length).toBe(2);
        // Check that bye winners are advanced to round 2
        const round2 = bracket.matches.filter(m => m.round === 2);
        const round2Ready = round2.filter(m => m.participant1 || m.participant2);
        expect(round2Ready.length).toBeGreaterThan(0);
    });
    it('links matches correctly', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const round1 = bracket.matches.filter(m => m.round === 1);
        const finals = bracket.matches.find(m => m.round === 2);
        // Both round 1 matches should link to finals
        expect(round1[0].nextMatchId).toBe(finals.id);
        expect(round1[0].nextMatchSlot).toBe(1);
        expect(round1[1].nextMatchId).toBe(finals.id);
        expect(round1[1].nextMatchSlot).toBe(2);
        // Finals should have no next match
        expect(finals.nextMatchId).toBeNull();
    });
});
describe('reportMatchResult', () => {
    it('advances winner to next match', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        // Report player_1 wins first match
        const match1 = bracket.matches.find(m => m.round === 1 && m.position === 1);
        const updatedBracket = reportMatchResult(bracket, match1.id, 'player_1');
        // Check match is completed
        const completedMatch = updatedBracket.matches.find(m => m.id === match1.id);
        expect(completedMatch.winner).toBe('player_1');
        expect(completedMatch.status).toBe('completed');
        // Check winner advanced to finals
        const finals = updatedBracket.matches.find(m => m.round === 2);
        expect(finals.participant1).toBe('player_1');
    });
    it('throws error for invalid winner', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        const match1 = bracket.matches.find(m => m.round === 1 && m.position === 1);
        expect(() => reportMatchResult(bracket, match1.id, 'invalid_player')).toThrow('not a participant');
    });
    it('throws error for invalid match', () => {
        const bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        expect(() => reportMatchResult(bracket, 'invalid_match', 'player_1')).toThrow('not found');
    });
    it('correctly simulates full tournament', () => {
        let bracket = generateSingleElimination({
            tournamentId: 'test',
            participants: createParticipants(4),
        });
        // Round 1: player_1 beats player_4, player_2 beats player_3
        const r1m1 = bracket.matches.find(m => m.round === 1 && m.position === 1);
        bracket = reportMatchResult(bracket, r1m1.id, 'player_1');
        const r1m2 = bracket.matches.find(m => m.round === 1 && m.position === 2);
        bracket = reportMatchResult(bracket, r1m2.id, 'player_2');
        // Finals should now be ready
        const finals = bracket.matches.find(m => m.round === 2);
        expect(finals.participant1).toBe('player_1');
        expect(finals.participant2).toBe('player_2');
        expect(finals.status).toBe('ready');
        // Finals: player_1 wins
        bracket = reportMatchResult(bracket, finals.id, 'player_1');
        const completedFinals = bracket.matches.find(m => m.round === 2);
        expect(completedFinals.winner).toBe('player_1');
        expect(completedFinals.status).toBe('completed');
    });
});
//# sourceMappingURL=single-elimination.test.js.map