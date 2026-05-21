import type { Bracket, Participant } from './types.js';
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
 * Report a match result in double elimination
 */
export declare function reportDoubleElimMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
//# sourceMappingURL=double-elimination.d.ts.map