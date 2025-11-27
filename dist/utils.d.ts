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
 * Distribute byes optimally - higher seeds get byes first
 */
export declare function assignByes(participantCount: number, bracketSize: number): Set<number>;
//# sourceMappingURL=utils.d.ts.map