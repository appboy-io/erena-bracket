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
 * e.g., for 8 participants: [1,8,4,5,2,7,3,6]
 * Results in matchups: 1v8, 4v5, 2v7, 3v6
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
 *
 * NOTE: This is the legacy "round up to power of 2" model. The new
 * single-elimination flow-byes generator does NOT use this. It's retained
 * for the double-elimination generator (which has not been migrated yet).
 */
export declare function assignByes(participantCount: number, bracketSize: number): Set<number>;
/**
 * Compute matches-per-round for a flow-byes single-elimination bracket.
 *
 * At each round, the alive count is halved (rounding up) by playing
 * `floor(alive / 2)` matches and giving exactly one bye when the count is odd.
 *
 * Examples:
 *   computeRoundCounts(2)  → [1]
 *   computeRoundCounts(3)  → [1, 1]
 *   computeRoundCounts(4)  → [2, 1]
 *   computeRoundCounts(5)  → [2, 1, 1]
 *   computeRoundCounts(8)  → [4, 2, 1]
 *   computeRoundCounts(13) → [6, 3, 2, 1]
 *   computeRoundCounts(17) → [8, 4, 2, 1, 1]
 */
export declare function computeRoundCounts(playerCount: number): number[];
/**
 * Compute byes-per-round for a flow-byes single-elimination bracket.
 * Returns an array where entry R-1 is 1 if round R has a bye, else 0.
 *
 * Examples:
 *   computeRoundByes(13) → [1, 1, 0, 0]   (R1, R2 each have 1 bye)
 *   computeRoundByes(17) → [1, 1, 1, 1, 0]
 *   computeRoundByes(8)  → [0, 0, 0]
 */
export declare function computeRoundByes(playerCount: number): number[];
/**
 * Compute the top-to-bottom seed ordering for `n` entry slots in a flow-byes
 * SE bracket. Wraps `generateSeedOrder(nextPowerOf2(n))` and drops phantom
 * positions (rank > n), producing a length-n array where index i = the seed
 * assigned to the i-th entry slot top-to-bottom.
 *
 * Example: compressedSeedOrder(13) =
 *   [1, 8, 9, 4, 13, 5, 12, 2, 7, 10, 3, 6, 11]
 */
export declare function compressedSeedOrder(n: number): number[];
/**
 * Per-round metadata for the losers bracket of a flow-byes double elimination.
 */
export interface LosersRoundInfo {
    /** 1-indexed LB round number. */
    round: number;
    /** True if this is a drop-in round (receives WB losers). */
    isDropIn: boolean;
    /** Number of advances from previous LB round entering this round. */
    carryover: number;
    /** Number of WB losers entering this round (0 for consolidation rounds). */
    dropIn: number;
    /** Total players alive entering this round = carryover + dropIn. */
    alive: number;
    /** Number of match records in this round = floor(alive / 2). */
    matches: number;
    /** 1 if this round has a bye, else 0 (= alive % 2). */
    byes: number;
    /** Number of advances out of this round = matches + byes. */
    advances: number;
    /**
     * The WB round whose losers feed this drop-in round (1-indexed).
     * Null for consolidation rounds.
     *
     * Mapping:
     *   LB R1                → WB R1
     *   LB R(even)           → WB R(R/2 + 1)
     *   LB R(odd, > 1)       → null  (consolidation)
     */
    wbLoserFeedRound: number | null;
}
/**
 * Compute the per-round shape of the LOSERS bracket for a flow-byes double
 * elimination tournament.
 *
 * LB structure:
 *   - Total LB rounds = `2 * (wbRounds - 1)` (0 when wbRounds <= 1).
 *   - LB R1 is a special drop-in round (no previous LB round).
 *     It pairs WB R1 losers with each other; if odd, one byes.
 *   - LB R(even) is a drop-in round: pairs previous LB round advances (carryover)
 *     with WB losers from WB round `R/2 + 1` (drop-in).
 *   - LB R(odd, > 1) is a consolidation round: pairs previous LB advances with
 *     each other; if odd, one byes.
 *
 * Byes are placed via routing (no bye-match record), matching the SE flow-byes
 * approach. Total match records = N - 2 (one fewer than SE's N-1 since the GF
 * absorbs the last elimination, but in our model GF matches are counted
 * separately so this is the LB-only count).
 *
 * For N=13, WB rounds=4 → LB has 6 rounds, shape:
 *   R1: drop-in,    carry=0, drop=6, alive=6, matches=3, byes=0, advances=3
 *   R2: drop-in,    carry=3, drop=3, alive=6, matches=3, byes=0, advances=3
 *   R3: consolidate,carry=3, drop=0, alive=3, matches=1, byes=1, advances=2
 *   R4: drop-in,    carry=2, drop=2, alive=4, matches=2, byes=0, advances=2
 *   R5: consolidate,carry=2, drop=0, alive=2, matches=1, byes=0, advances=1
 *   R6: drop-in,    carry=1, drop=1, alive=2, matches=1, byes=0, advances=1
 */
export declare function computeLosersBracketShape(playerCount: number): LosersRoundInfo[];
/**
 * @deprecated — kept for backwards compatibility / experimentation. Use
 * `compressedSeedOrder` for slot-based seeding.
 *
 * Pair `n` players (passed as ranks 1..n where rank 1 = top seed) into
 * `floor(n/2)` R1 matches arranged top-to-bottom in standard SE bracket
 * position order. If `n` is odd, rank 1 byes and is appended to the end.
 */
export declare function standardRankPairing(n: number): number[];
//# sourceMappingURL=utils.d.ts.map