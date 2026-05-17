import type { Bracket, Participant } from './types.js';
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
export declare function generateSingleElimination(options: SingleEliminationOptions): Bracket;
/**
 * Report a match result and advance the winner.
 */
export declare function reportMatchResult(bracket: Bracket, matchId: string, winnerId: string): Bracket;
//# sourceMappingURL=single-elimination.d.ts.map