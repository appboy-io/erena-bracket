import type { Bracket, Participant } from './types.js';
export interface SingleEliminationOptions {
    tournamentId: string;
    participants: Participant[];
}
/**
 * Generate a single elimination bracket
 */
export declare function generateSingleElimination(options: SingleEliminationOptions): Bracket;
/**
 * Report a match result and advance the winner
 */
export declare function reportMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
//# sourceMappingURL=single-elimination.d.ts.map