import type { Bracket, Participant } from './types.js';
export interface SingleEliminationOptions {
    tournamentId: string;
    participants: Participant[];
}
/**
 * Generate a single elimination bracket
 */
export declare function generateSingleElimination(options: SingleEliminationOptions): Bracket;
/** Build a single-elim bracket from an explicit slot array (length must be a
 *  power of two). slots[i] is the participant in round-1 slot i, or null (bye). */
export declare function buildSingleElimination(tournamentId: string, slots: (Participant | null)[]): Bracket;
/**
 * Report a match result and advance the winner
 */
export declare function reportMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
//# sourceMappingURL=single-elimination.d.ts.map