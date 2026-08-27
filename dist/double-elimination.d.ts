import type { Match, Bracket, Participant } from './types.js';
export interface DoubleEliminationOptions {
    tournamentId: string;
    participants: Participant[];
    grandFinalReset?: boolean;
}
/**
 * Generate a double elimination bracket
 *
 * Structure:
 * - Winners bracket: Standard single elimination
 * - Losers bracket: Losers from winners drop down
 * - Grand finals: Winners bracket winner vs Losers bracket winner
 */
export declare function generateDoubleElimination(options: DoubleEliminationOptions): Bracket;
/** Build a double-elim bracket (winners + losers + grand final) from an explicit
 *  round-1 slot array (length must be a power of two). slots[i] is the
 *  participant in round-1 slot i, or null (bye). */
export declare function buildDoubleElimination(tournamentId: string, slots: (Participant | null)[], grandFinalReset?: boolean): Bracket;
/**
 * Crossover plans for a losers bracket seeded with direct entrants.
 *
 * CROSSOVER_PLAN above assumes the losers bracket starts empty and does not
 * carry over. That is false here: entry rounds put players in it who never
 * played this phase's winners bracket, which changes which pairs can collide.
 * Re-derived with `scripts/crossover-search.mjs entry <k> <L>`; see
 * docs/losers-crossover.md for the numbers.
 *
 * Note winners round 1 appears here and does not appear in CROSSOVER_PLAN. In a
 * standard bracket its losers pair against each other on fixed geometry; here
 * each merges against a surviving direct entrant, so the seat is a free choice
 * worth up to two rounds of separation.
 *
 * Keyed "{winnersBracketSize}x{directEntrants}". Only the four shapes the
 * exhaustive search can actually solve are listed: winners brackets of 32+
 * make the search intractable, because at that size it must also permute
 * winners round 1 (16! and up) alongside every later round -- see
 * docs/losers-crossover.md for the arithmetic. A shape with no entry falls
 * back to identity via `entryCrossoverNameFor` below, which is safe but not
 * necessarily optimal.
 */
export declare const ENTRY_CROSSOVER_PLAN: Record<string, string[]>;
/**
 * Permutation name for winners round `wRound` (>= 1) when the losers bracket
 * starts seeded with `directEntrants` entrants. Falls back to `'identity'`
 * for any shape the search hasn't solved -- safe, but potentially up to two
 * rounds short of optimal separation (see docs/losers-crossover.md).
 */
export declare function entryCrossoverNameFor(bracketSize: number, directEntrants: number, wRound: number): string;
/**
 * Resolve "phantom" byes: a match slot can never be filled when its feeder is a
 * bye (winners-bracket bye → no loser) or a dead double-bye (→ no winner).
 * - one real player + one phantom slot → that player walks over (status 'bye', advance).
 * - both slots phantom → the match itself is dead (status 'bye', winner null, advances nobody).
 * Idempotent; iterates to a fixpoint so cascades resolve. Safe to call repeatedly.
 */
export declare function propagateByes(matches: Match[]): void;
/**
 * Report a match result in double elimination
 */
export declare function reportDoubleElimMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
/** Build a double-elim bracket in which `losersEntrants` start in the losers
 *  bracket. `winnersSlots` is the winners round-1 slot array (length a power of
 *  two, null for a bye); `losersEntrants` must be the winners round-1 loser
 *  count times a power of two, or the shape cannot reduce cleanly. */
export declare function buildDoubleEliminationWithEntry(tournamentId: string, winnersSlots: (Participant | null)[], losersEntrants: (Participant | null)[], grandFinalReset?: boolean): Bracket;
//# sourceMappingURL=double-elimination.d.ts.map