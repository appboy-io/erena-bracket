import type { Match, Bracket, Participant } from './types.js';
import {
  nextPowerOf2,
  calculateRounds,
  generateMatchId,
  generateSeedOrder,
  assignByes,
} from './utils.js';

export interface SingleEliminationOptions {
  tournamentId: string;
  participants: Participant[];
}

/**
 * Generate a single elimination bracket
 */
export function generateSingleElimination(
  options: SingleEliminationOptions
): Bracket {
  const { tournamentId, participants } = options;
  const participantCount = participants.length;

  if (participantCount < 2) {
    throw new Error('Need at least 2 participants for a bracket');
  }

  const bracketSize = nextPowerOf2(participantCount);
  const totalRounds = calculateRounds(bracketSize);
  const seedOrder = generateSeedOrder(bracketSize);
  const byeSeeds = assignByes(participantCount, bracketSize);

  // Create participant lookup by seed
  const participantBySeed = new Map<number, Participant>();
  for (const p of participants) {
    participantBySeed.set(p.seed, p);
  }

  const matches: Match[] = [];

  // Generate all rounds
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);

    for (let position = 1; position <= matchesInRound; position++) {
      const matchId = generateMatchId(tournamentId, 'winners', round, position);

      // Calculate next match info
      let nextMatchId: string | null = null;
      let nextMatchSlot: 1 | 2 | null = null;

      if (round < totalRounds) {
        const nextPosition = Math.ceil(position / 2);
        nextMatchId = generateMatchId(tournamentId, 'winners', round + 1, nextPosition);
        nextMatchSlot = position % 2 === 1 ? 1 : 2;
      }

      const match: Match = {
        id: matchId,
        round,
        position,
        bracketType: 'winners',
        participant1: null,
        participant2: null,
        participant1Seed: null,
        participant2Seed: null,
        winner: null,
        status: 'pending',
        nextMatchId,
        nextMatchSlot,
        loserNextMatchId: null,
        loserNextMatchSlot: null,
      };

      matches.push(match);
    }
  }

  // Populate first round with participants based on seeding
  const firstRoundMatches = matches.filter(m => m.round === 1);
  const firstRoundMatchCount = firstRoundMatches.length;

  for (let i = 0; i < firstRoundMatchCount; i++) {
    const match = firstRoundMatches[i]!;
    const seed1 = seedOrder[i * 2]!;
    const seed2 = seedOrder[i * 2 + 1]!;

    const p1 = participantBySeed.get(seed1);
    const p2 = participantBySeed.get(seed2);

    const p1Exists = p1 !== undefined;
    const p2Exists = p2 !== undefined;

    if (!p1Exists && !p2Exists) {
      // Neither participant exists - shouldn't happen
      match.status = 'pending';
    } else if (p1Exists && !p2Exists) {
      // P1 exists, P2 doesn't - P1 gets a bye
      match.participant1 = p1.id;
      match.participant1Seed = seed1;
      match.participant2 = null;
      match.participant2Seed = null;
      match.winner = p1.id;
      match.status = 'bye';

      // Advance winner to next match
      if (match.nextMatchId) {
        advanceWinner(matches, match.nextMatchId, match.nextMatchSlot!, p1.id, seed1);
      }
    } else if (!p1Exists && p2Exists) {
      // P2 exists, P1 doesn't - P2 gets a bye
      match.participant1 = null;
      match.participant1Seed = null;
      match.participant2 = p2.id;
      match.participant2Seed = seed2;
      match.winner = p2.id;
      match.status = 'bye';

      // Advance winner to next match
      if (match.nextMatchId) {
        advanceWinner(matches, match.nextMatchId, match.nextMatchSlot!, p2.id, seed2);
      }
    } else if (p1Exists && p2Exists) {
      // Normal match
      match.participant1 = p1?.id ?? null;
      match.participant1Seed = seed1;
      match.participant2 = p2?.id ?? null;
      match.participant2Seed = seed2;
      match.status = 'ready';
    }
  }

  // Update status of matches that have both participants filled
  updateMatchStatuses(matches);

  return {
    tournamentId,
    format: 'single_elim',
    matches,
    totalRounds,
    participantCount,
  };
}

/**
 * Advance a winner to their next match
 */
function advanceWinner(
  matches: Match[],
  nextMatchId: string,
  slot: 1 | 2,
  participantId: string,
  seed: number
): void {
  const nextMatch = matches.find(m => m.id === nextMatchId);
  if (!nextMatch) return;

  if (slot === 1) {
    nextMatch.participant1 = participantId;
    nextMatch.participant1Seed = seed;
  } else {
    nextMatch.participant2 = participantId;
    nextMatch.participant2Seed = seed;
  }
}

/**
 * Update match statuses based on participant availability
 */
function updateMatchStatuses(matches: Match[]): void {
  for (const match of matches) {
    if (match.status === 'bye' || match.status === 'completed') continue;

    if (match.participant1 && match.participant2) {
      match.status = 'ready';
    } else {
      match.status = 'pending';
    }
  }
}

/**
 * Report a match result and advance the winner
 */
export function reportMatchResult(
  bracket: Bracket,
  matchId: string,
  winnerId: string
): Bracket {
  const matches = [...bracket.matches];
  const matchIndex = matches.findIndex(m => m.id === matchId);

  if (matchIndex === -1) {
    throw new Error(`Match ${matchId} not found`);
  }

  const match = { ...matches[matchIndex]! };
  matches[matchIndex] = match;

  if (match.participant1 !== winnerId && match.participant2 !== winnerId) {
    throw new Error(`Winner ${winnerId} is not a participant in match ${matchId}`);
  }

  match.winner = winnerId;
  match.status = 'completed';

  const winnerSeed = match.participant1 === winnerId
    ? match.participant1Seed
    : match.participant2Seed;

  // Advance winner to next match
  if (match.nextMatchId && winnerSeed !== null) {
    advanceWinner(matches, match.nextMatchId, match.nextMatchSlot!, winnerId, winnerSeed);
    updateMatchStatuses(matches);
  }

  return {
    ...bracket,
    matches,
  };
}
