import type { Participant } from './types.js';
/**
 * Get the next power of 2 >= n
 */
export declare function nextPowerOf2(n: number): number;
/**
 * Check if n is a power of 2
 */
export declare function isPowerOf2(n: number): boolean;
/**
 * Calculate number of rounds needed for n participants
 */
export declare function calculateRounds(participantCount: number): number;
/**
 * Generate a unique match ID
 */
export declare function generateMatchId(tournamentId: string, bracketType: string, round: number, position: number): string;
/**
 * Generate standard seeding order for a bracket
 * This ensures top seeds meet in later rounds
 * e.g., for 8 participants: [1,8,5,4,3,6,7,2]
 * Results in matchups: 1v8, 4v5, 3v6, 2v7
 */
export declare function generateSeedOrder(bracketSize: number): number[];
/**
 * Return the set of seed positions that are "phantoms" — slots without a real
 * participant because participantCount < bracketSize. These are always the
 * highest-numbered seeds (e.g. 13 participants in a 16-slot bracket → {14,15,16}).
 *
 * Standard tournament convention: top seeds receive the privilege of a bye by
 * being paired with these phantom slots, then auto-advancing. Consumers of
 * this set check whether each side of a match is a phantom to decide whether
 * to mark the match as a bye and advance the real player.
 */
export declare function assignByes(participantCount: number, bracketSize: number): Set<number>;
/** Map participants (by their .seed) into an explicit slot array of length
 *  bracketSize using the standard seed order. Missing seeds become null (byes). */
export declare function slotsFromSeeding(participants: Participant[], bracketSize: number): (Participant | null)[];
//# sourceMappingURL=utils.d.ts.map