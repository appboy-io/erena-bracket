import type { Bracket, Match } from './types.js';

/**
 * Disqualify a participant from a match.
 *
 * Effects:
 *  - The match's status becomes 'disqualified'.
 *  - The opponent (if present) is set as winner and advanced to the next winners-bracket match.
 *  - The DQ'd participant is NOT placed in the losers bracket (double-elim).
 */
export function disqualifyParticipant(
  bracket: Bracket,
  matchId: string,
  dqParticipantId: string
): Bracket {
  const matches: Match[] = bracket.matches.map(m => ({ ...m }));
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.participant1 !== dqParticipantId && match.participant2 !== dqParticipantId) {
    throw new Error(`Participant ${dqParticipantId} is not a participant in match ${matchId}`);
  }

  // Determine opponent (may be null if match wasn't fully populated)
  const opponentId =
    match.participant1 === dqParticipantId ? match.participant2 : match.participant1;
  const opponentSeed =
    match.participant1 === dqParticipantId ? match.participant2Seed : match.participant1Seed;

  match.status = 'disqualified';
  match.winner = opponentId; // null if no opponent

  // Advance opponent to next winners-bracket match if present
  if (opponentId && match.nextMatchId && match.nextMatchSlot && opponentSeed !== null) {
    const nextMatch = matches.find(m => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 1) {
        nextMatch.participant1 = opponentId;
        nextMatch.participant1Seed = opponentSeed;
      } else {
        nextMatch.participant2 = opponentId;
        nextMatch.participant2Seed = opponentSeed;
      }
      // If both participants now present, mark ready
      if (nextMatch.participant1 && nextMatch.participant2 && nextMatch.status === 'pending') {
        nextMatch.status = 'ready';
      }
    }
  }

  // Explicitly do NOT advance the DQ'd player to losersNextMatch.
  // (Double-elim's normal reportMatchResult would place the loser there.)

  return { ...bracket, matches };
}
