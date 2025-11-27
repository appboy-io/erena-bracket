/**
 * Get the next power of 2 >= n
 */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Check if n is a power of 2
 */
export function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Calculate number of rounds needed for n participants
 */
export function calculateRounds(participantCount: number): number {
  if (participantCount <= 1) return 0;
  return Math.ceil(Math.log2(participantCount));
}

/**
 * Generate a unique match ID
 */
export function generateMatchId(
  tournamentId: string,
  bracketType: string,
  round: number,
  position: number
): string {
  const prefix = bracketType === 'winners' ? 'W' : bracketType === 'losers' ? 'L' : 'GF';
  return `${tournamentId}_${prefix}R${round}M${position}`;
}

/**
 * Generate standard seeding order for a bracket
 * This ensures top seeds meet in later rounds
 * e.g., for 8 participants: [1,8,5,4,3,6,7,2]
 * Results in matchups: 1v8, 4v5, 3v6, 2v7
 */
export function generateSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  if (bracketSize === 2) return [1, 2];

  const halfSize = bracketSize / 2;
  const topHalf = generateSeedOrder(halfSize);
  const bottomHalf = topHalf.map(seed => bracketSize + 1 - seed);

  const result: number[] = [];
  for (let i = 0; i < halfSize; i++) {
    result.push(topHalf[i]!);
    result.push(bottomHalf[i]!);
  }

  return result;
}

/**
 * Distribute byes optimally - higher seeds get byes first
 */
export function assignByes(
  participantCount: number,
  bracketSize: number
): Set<number> {
  const byeCount = bracketSize - participantCount;
  const byeSeeds = new Set<number>();

  // Byes go to the highest seeds (lowest seed numbers)
  for (let i = 1; i <= byeCount; i++) {
    byeSeeds.add(i);
  }

  return byeSeeds;
}
