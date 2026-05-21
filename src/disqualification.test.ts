import { describe, it, expect } from 'vitest';
import { generateSingleEliminationBracket } from './single-elimination';
import { generateDoubleEliminationBracket } from './double-elimination';
import { disqualifyParticipant } from './disqualification';

describe('disqualifyParticipant (single elimination)', () => {
  it('advances the opponent when one participant is DQ\'d in a ready match', () => {
    const bracket = generateSingleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
      { id: 'p3', seed: 3 },
      { id: 'p4', seed: 4 },
    ]);
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

  it('completes the match with no winner if both spots already advanced (corner case)', () => {
    const bracket = generateSingleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
    ]);
    const match = bracket.matches[0]!;
    // DQ before opponent assigned (only one participant set somehow)
    match.participant2 = null;
    const result = disqualifyParticipant(bracket, match.id, 'p1');
    const updated = result.matches.find(m => m.id === match.id)!;
    expect(updated.status).toBe('disqualified');
    expect(updated.winner).toBeNull();
  });
});

describe('disqualifyParticipant (double elimination)', () => {
  it('does NOT send the DQ\'d player to losers bracket', () => {
    const bracket = generateDoubleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
      { id: 'p3', seed: 3 },
      { id: 'p4', seed: 4 },
    ]);
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
    const bracket = generateDoubleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
      { id: 'p3', seed: 3 },
      { id: 'p4', seed: 4 },
    ]);
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
    const bracket = generateSingleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
    ]);
    const match = bracket.matches[0]!;
    expect(() => disqualifyParticipant(bracket, match.id, 'pX')).toThrow(/not a participant/);
  });

  it('throws if the match does not exist', () => {
    const bracket = generateSingleEliminationBracket('t1', [
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
    ]);
    expect(() => disqualifyParticipant(bracket, 'nope', 'p1')).toThrow(/not found/);
  });
});
