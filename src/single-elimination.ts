import type { Match, Bracket, Participant } from './types.js';
import {
  generateMatchId,
  computeRoundCounts,
  computeRoundByes,
  compressedSeedOrder,
} from './utils.js';

export interface SingleEliminationOptions {
  tournamentId: string;
  participants: Participant[];
}

/**
 * Generate a single elimination bracket with FLOW BYES.
 *
 * At each round, the alive count is halved (rounding up). When the alive
 * count is odd, exactly one player byes — and the bye SLOT is placed at
 * alternating ends of the bracket (R1 top, R2 bottom, R3 top, ...) to
 * spread the bye privilege across different bracket halves.
 *
 * Match record properties:
 *   - Total match records = N - 1 (the elimination minimum).
 *   - Round R has `floor(aliveR / 2)` match records.
 *   - A round-R bye is NOT a separate record: it's implemented by routing
 *     the bye-getter's predecessor (or, in R1, the bye seed directly) past
 *     round R to round R+1.
 *
 * Seeding:
 *   - The N "entry slots" of round 1 (the bye-slot if present, plus each
 *     match's two slots, top-to-bottom) receive seeds 1..N in a standard
 *     bracket order. Concretely we take `generateSeedOrder(nextPowerOf2(N))`
 *     and drop phantoms (ranks > N), producing N entry-position → seed
 *     mappings. The top seed (seed 1) lands in the top entry slot — which
 *     is the R1 bye-slot when one exists.
 */
export function generateSingleElimination(
  options: SingleEliminationOptions
): Bracket {
  const { tournamentId, participants } = options;
  const participantCount = participants.length;

  if (participantCount < 2) {
    throw new Error('Need at least 2 participants for a bracket');
  }

  const roundCounts = computeRoundCounts(participantCount);
  const roundByes = computeRoundByes(participantCount);
  const totalRounds = roundCounts.length;

  const participantBySeed = new Map<number, Participant>();
  for (const p of participants) {
    participantBySeed.set(p.seed, p);
  }

  // === Create all match records ===
  const matches: Match[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = roundCounts[round - 1]!;
    for (let position = 1; position <= matchesInRound; position++) {
      matches.push({
        id: generateMatchId(tournamentId, 'winners', round, position),
        round,
        position,
        bracketType: 'winners',
        participant1: null,
        participant2: null,
        participant1Seed: null,
        participant2Seed: null,
        winner: null,
        status: 'pending',
        nextMatchId: null,
        nextMatchSlot: null,
        loserNextMatchId: null,
        loserNextMatchSlot: null,
      });
    }
  }

  // === Build linking structure ===
  // For each round R, an OutputRef is one of:
  //   { kind: 'matchWinner', round, position }
  //   { kind: 'bye', round }
  // Top-to-bottom outputs of round R = R's match winners interleaved with the
  // R-round bye (if any) placed at top (R odd) or bottom (R even).
  //
  // For each round R+1, input slots top-to-bottom = R+1's match slots
  // interleaved with the R+1-round bye-slot at top (R+1 odd) or bottom.

  type SlotRef =
    | { kind: 'matchSlot'; round: number; position: number; slot: 1 | 2 }
    | { kind: 'bye'; round: number };

  type OutputRef =
    | { kind: 'matchWinner'; round: number; position: number }
    | { kind: 'bye'; round: number };

  const byeAtTop = (round: number): boolean => round % 2 === 1;

  const buildInputSlots = (round: number): SlotRef[] => {
    const matchesInRound = roundCounts[round - 1]!;
    const byeInRound = roundByes[round - 1]!;
    const realSlots: SlotRef[] = [];
    for (let p = 1; p <= matchesInRound; p++) {
      realSlots.push({ kind: 'matchSlot', round, position: p, slot: 1 });
      realSlots.push({ kind: 'matchSlot', round, position: p, slot: 2 });
    }
    if (byeInRound === 1) {
      return byeAtTop(round)
        ? [{ kind: 'bye', round }, ...realSlots]
        : [...realSlots, { kind: 'bye', round }];
    }
    return realSlots;
  };

  const buildOutputs = (round: number): OutputRef[] => {
    const matchesInRound = roundCounts[round - 1]!;
    const byeInRound = roundByes[round - 1]!;
    const matchOutputs: OutputRef[] = [];
    for (let p = 1; p <= matchesInRound; p++) {
      matchOutputs.push({ kind: 'matchWinner', round, position: p });
    }
    if (byeInRound === 1) {
      return byeAtTop(round)
        ? [{ kind: 'bye', round }, ...matchOutputs]
        : [...matchOutputs, { kind: 'bye', round }];
    }
    return matchOutputs;
  };

  const outputKey = (o: OutputRef): string =>
    o.kind === 'matchWinner' ? `m_${o.round}_${o.position}` : `b_${o.round}`;

  // Map round-R OutputRef → round-(R+1) SlotRef (one step).
  const outputToSlot = new Map<string, SlotRef>();
  for (let r = 1; r < totalRounds; r++) {
    const outs = buildOutputs(r);
    const slots = buildInputSlots(r + 1);
    if (outs.length !== slots.length) {
      throw new Error(
        `Linking mismatch: round ${r} outputs=${outs.length}, round ${r + 1} slots=${slots.length}`
      );
    }
    for (let i = 0; i < outs.length; i++) {
      outputToSlot.set(outputKey(outs[i]!), slots[i]!);
    }
  }

  // Resolve final destination for an output: follow the chain through any
  // intermediate bye-slots until we land on a real matchSlot (or null at
  // the bracket's end).
  const resolveDest = (
    startOutput: OutputRef
  ): { matchId: string; slot: 1 | 2 } | null => {
    let cur: OutputRef = startOutput;
    while (true) {
      const slot = outputToSlot.get(outputKey(cur));
      if (!slot) return null;
      if (slot.kind === 'matchSlot') {
        return {
          matchId: generateMatchId(tournamentId, 'winners', slot.round, slot.position),
          slot: slot.slot,
        };
      }
      // bye slot → follow the bye output chain
      cur = { kind: 'bye', round: slot.round };
    }
  };

  // Apply nextMatchId/Slot to each match record.
  for (const m of matches) {
    if (m.round < totalRounds) {
      const dest = resolveDest({ kind: 'matchWinner', round: m.round, position: m.position });
      if (dest) {
        m.nextMatchId = dest.matchId;
        m.nextMatchSlot = dest.slot;
      }
    }
  }

  // === Assign seeds to R1 entry slots ===
  // Build the list of R1 entry slots top-to-bottom. There are exactly N
  // entry slots: the R1 bye-slot (if present) plus each R1 match's two
  // slots in order.

  const r1Slots: SlotRef[] = buildInputSlots(1);
  // r1Slots.length should equal participantCount (= aliveR1).
  if (r1Slots.length !== participantCount) {
    throw new Error(
      `Internal: R1 input slot count ${r1Slots.length} !== participantCount ${participantCount}`
    );
  }

  // Assign seeds 1..N to these slots using the standard SE seed order with
  // phantoms compressed (drop ranks > N from generateSeedOrder(nextPow2(N))).
  const compressedOrder = compressedSeedOrder(participantCount);
  if (compressedOrder.length !== participantCount) {
    throw new Error('Internal: compressed seed order length mismatch');
  }

  for (let i = 0; i < r1Slots.length; i++) {
    const slot = r1Slots[i]!;
    const seed = compressedOrder[i]!;
    const participant = participantBySeed.get(seed);
    if (!participant) {
      throw new Error(`Missing participant for seed ${seed}`);
    }

    if (slot.kind === 'matchSlot') {
      const targetMatch = matches.find(m => m.round === slot.round && m.position === slot.position);
      if (!targetMatch) continue;
      if (slot.slot === 1) {
        targetMatch.participant1 = participant.id;
        targetMatch.participant1Seed = seed;
      } else {
        targetMatch.participant2 = participant.id;
        targetMatch.participant2Seed = seed;
      }
    } else {
      // R1 bye-slot: advance the seed directly through the bye chain.
      const dest = resolveDest({ kind: 'bye', round: 1 });
      if (dest) {
        const targetMatch = matches.find(m => m.id === dest.matchId);
        if (targetMatch) {
          if (dest.slot === 1) {
            targetMatch.participant1 = participant.id;
            targetMatch.participant1Seed = seed;
          } else {
            targetMatch.participant2 = participant.id;
            targetMatch.participant2Seed = seed;
          }
        }
      }
    }
  }

  updateMatchStatuses(matches);

  return {
    tournamentId,
    format: 'single_elim',
    matches,
    totalRounds,
    participantCount,
  };
}

function updateMatchStatuses(matches: Match[]): void {
  for (const match of matches) {
    if (match.status === 'completed' || match.status === 'bye') continue;
    if (match.participant1 && match.participant2) {
      match.status = 'ready';
    } else {
      match.status = 'pending';
    }
  }
}

/**
 * Report a match result and advance the winner.
 */
export function reportMatchResult(
  bracket: Bracket,
  matchId: string,
  winnerId: string
): Bracket {
  const matches = bracket.matches.map(m => ({ ...m }));
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.participant1 !== winnerId && match.participant2 !== winnerId) {
    throw new Error(`Winner ${winnerId} is not a participant in match ${matchId}`);
  }

  match.winner = winnerId;
  match.status = 'completed';

  const winnerSeed =
    match.participant1 === winnerId ? match.participant1Seed : match.participant2Seed;

  if (match.nextMatchId && winnerSeed !== null) {
    advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot!, winnerId, winnerSeed);
  }

  updateMatchStatuses(matches);

  return {
    ...bracket,
    matches,
  };
}

function advanceToMatch(
  matches: Match[],
  matchId: string,
  slot: 1 | 2,
  participantId: string,
  seed: number
): void {
  const target = matches.find(m => m.id === matchId);
  if (!target) return;
  if (slot === 1) {
    target.participant1 = participantId;
    target.participant1Seed = seed;
  } else {
    target.participant2 = participantId;
    target.participant2Seed = seed;
  }
}
