import type { Bracket, Participant } from './types.js';
export interface DoubleEliminationOptions {
    tournamentId: string;
    participants: Participant[];
    grandFinalReset?: boolean;
}
/**
 * Generate a double elimination bracket with FLOW BYES.
 *
 * Winners bracket (WB) uses the same flow-byes shape as single-elimination:
 *   - `computeRoundCounts(N)` matches per round, `computeRoundByes(N)` byes per
 *     round, byes implemented as routing (no bye-match records).
 *   - Total WB matches = N - 1.
 *
 * Losers bracket (LB) uses the shape from `computeLosersBracketShape(N)`:
 *   - 2 * (wbRounds - 1) rounds, alternating drop-in and consolidate.
 *   - Drop-in rounds: pair prev LB advances ("carryover") with WB losers
 *     ("drop-in"). Slot 1 = carryover, slot 2 = drop-in.
 *   - Consolidate rounds: pair prev LB advances with each other.
 *   - Byes again implemented purely as routing — no bye-match records.
 *   - Total LB matches = N - 2.
 *
 * Grand finals: GF1 (WB winner vs LB winner) + GF2 (bracket reset). Both
 * records are always created when `grandFinalReset` is true (default).
 *
 * Total record count = (N - 1) + (N - 2) + (1 or 2) = 2N - 3 or 2N - 2.
 */
export declare function generateDoubleElimination(options: DoubleEliminationOptions): Bracket;
/**
 * Report a match result in double elimination.
 */
export declare function reportDoubleElimMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
//# sourceMappingURL=double-elimination.d.ts.map