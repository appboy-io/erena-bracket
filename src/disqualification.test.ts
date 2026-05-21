import { describe, it, expect } from 'vitest';
import { generateSingleElimination } from './single-elimination.js';
import { generateDoubleElimination } from './double-elimination.js';
import { disqualifyParticipant } from './disqualification.js';
import type { Participant } from './types.js';

function createParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    seed: i + 1,
    name: `Player ${i + 1}`,
  }));
}

describe('disqualifyParticipant (single elimination)', () => {
  it('advances the opponent when one participant is DQ\'d in a ready match', () => {
    const bracket = generateSingleElimination({
      tournamentId: 't1',
      participants: createParticipants(4),
    });
    const firstRoundMatch = bracket.matches.find(m => m.round === 1 && m.position === 1)!;
    const dqedId = firstRoundMatch.participant1!;
    const opponentId = firstRoundMatch.participant2!;

    const result = disqualifyParticipant(bracket, firstRoundMatch.id, dqedId);

    const updated = result.matches.find(m => m.id === firstRoundMatch.id)!;
    expect(updated.status).toBe('disqualified');
    expect(updated.winner).toBe(opponentId);

    // Opponent advanced to next match
    const nextMatch = result.matches.find(m => m.id === updated.nextMatchId)!;
    expect([nextMatch.participant1, nextMatch.participant2]).toContain(opponentId);
  });

  it('marks match disqualified with null winner when opponent slot is empty', () => {
    const bracket = generateSingleElimination({
      tournamentId: 't1',
      participants: createParticipants(2),
    });
    const match = bracket.matches[0]!;
    // Simulate match where the opponent slot was never filled
    match.participant2 = null;
    const result = disqualifyParticipant(bracket, match.id, match.participant1!);
    const updated = result.matches.find(m => m.id === match.id)!;
    expect(updated.status).toBe('disqualified');
    expect(updated.winner).toBeNull();
  });
});

describe('disqualifyParticipant (double elimination)', () => {
  it('does NOT send the DQ\'d player to losers bracket', () => {
    const bracket = generateDoubleElimination({
      tournamentId: 't1',
      participants: createParticipants(4),
    });
    const firstWinnersMatch = bracket.matches.find(
      m => m.bracketType === 'winners' && m.round === 1 && m.position === 1
    )!;
    const dqedId = firstWinnersMatch.participant1!;

    const result = disqualifyParticipant(bracket, firstWinnersMatch.id, dqedId);

    // The DQ'd player should NOT appear in any losers-bracket match
    const losersMatches = result.matches.filter(m => m.bracketType === 'losers');
    for (const m of losersMatches) {
      expect(m.participant1).not.toBe(dqedId);
      expect(m.participant2).not.toBe(dqedId);
    }
  });

  it('advances the opponent to the next winners-bracket match', () => {
    const bracket = generateDoubleElimination({
      tournamentId: 't1',
      participants: createParticipants(4),
    });
    const firstWinnersMatch = bracket.matches.find(
      m => m.bracketType === 'winners' && m.round === 1 && m.position === 1
    )!;
    const dqedId = firstWinnersMatch.participant1!;
    const opponentId = firstWinnersMatch.participant2!;

    const result = disqualifyParticipant(bracket, firstWinnersMatch.id, dqedId);

    const nextMatch = result.matches.find(m => m.id === firstWinnersMatch.nextMatchId)!;
    expect([nextMatch.participant1, nextMatch.participant2]).toContain(opponentId);
  });
});

describe('disqualifyParticipant validation', () => {
  it('throws if the participant is not in the match', () => {
    const bracket = generateSingleElimination({
      tournamentId: 't1',
      participants: createParticipants(2),
    });
    const match = bracket.matches[0]!;
    expect(() => disqualifyParticipant(bracket, match.id, 'pX')).toThrow(/not a participant/);
  });

  it('throws if the match does not exist', () => {
    const bracket = generateSingleElimination({
      tournamentId: 't1',
      participants: createParticipants(2),
    });
    expect(() => disqualifyParticipant(bracket, 'nope', 'p1')).toThrow(/not found/);
  });
});
