/**
 * Get the next power of 2 >= n
 */
export function nextPowerOf2(n) {
    if (n <= 1)
        return 1;
    return Math.pow(2, Math.ceil(Math.log2(n)));
}
/**
 * Check if n is a power of 2
 */
export function isPowerOf2(n) {
    return n > 0 && (n & (n - 1)) === 0;
}
/**
 * Calculate number of rounds needed for n participants
 */
export function calculateRounds(participantCount) {
    if (participantCount <= 1)
        return 0;
    return Math.ceil(Math.log2(participantCount));
}
/**
 * Generate a unique match ID
 */
export function generateMatchId(tournamentId, bracketType, round, position) {
    const prefix = bracketType === 'winners' ? 'W' : bracketType === 'losers' ? 'L' : 'GF';
    return `${tournamentId}_${prefix}R${round}M${position}`;
}
/**
 * Generate standard seeding order for a bracket
 * This ensures top seeds meet in later rounds
 * e.g., for 8 participants: [1,8,5,4,3,6,7,2]
 * Results in matchups: 1v8, 4v5, 3v6, 2v7
 */
export function generateSeedOrder(bracketSize) {
    if (bracketSize === 1)
        return [1];
    if (bracketSize === 2)
        return [1, 2];
    const halfSize = bracketSize / 2;
    const topHalf = generateSeedOrder(halfSize);
    const bottomHalf = topHalf.map(seed => bracketSize + 1 - seed);
    const result = [];
    for (let i = 0; i < halfSize; i++) {
        result.push(topHalf[i]);
        result.push(bottomHalf[i]);
    }
    return result;
}
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
export function assignByes(participantCount, bracketSize) {
    const byeSeeds = new Set();
    for (let seed = participantCount + 1; seed <= bracketSize; seed++) {
        byeSeeds.add(seed);
    }
    return byeSeeds;
}
//# sourceMappingURL=utils.js.map