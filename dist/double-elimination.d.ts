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
//# sourceMappingURL=double-elimination.d.ts.map