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
 * e.g., for 8 participants: [1,8,4,5,2,7,3,6]
 * Results in matchups: 1v8, 4v5, 2v7, 3v6
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
 *
 * NOTE: This is the legacy "round up to power of 2" model. The new
 * single-elimination flow-byes generator does NOT use this. It's retained
 * for the double-elimination generator (which has not been migrated yet).
 */
export function assignByes(participantCount, bracketSize) {
    const byeSeeds = new Set();
    for (let seed = participantCount + 1; seed <= bracketSize; seed++) {
        byeSeeds.add(seed);
    }
    return byeSeeds;
}
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
export function computeRoundCounts(playerCount) {
    if (playerCount < 2)
        return [];
    const counts = [];
    let alive = playerCount;
    while (alive > 1) {
        const matches = Math.floor(alive / 2);
        counts.push(matches);
        alive = matches + (alive % 2);
    }
    return counts;
}
/**
 * Compute byes-per-round for a flow-byes single-elimination bracket.
 * Returns an array where entry R-1 is 1 if round R has a bye, else 0.
 *
 * Examples:
 *   computeRoundByes(13) → [1, 1, 0, 0]   (R1, R2 each have 1 bye)
 *   computeRoundByes(17) → [1, 1, 1, 1, 0]
 *   computeRoundByes(8)  → [0, 0, 0]
 */
export function computeRoundByes(playerCount) {
    if (playerCount < 2)
        return [];
    const byes = [];
    let alive = playerCount;
    while (alive > 1) {
        byes.push(alive % 2);
        alive = Math.ceil(alive / 2);
    }
    return byes;
}
/**
 * Compute the top-to-bottom seed ordering for `n` entry slots in a flow-byes
 * SE bracket. Wraps `generateSeedOrder(nextPowerOf2(n))` and drops phantom
 * positions (rank > n), producing a length-n array where index i = the seed
 * assigned to the i-th entry slot top-to-bottom.
 *
 * Example: compressedSeedOrder(13) =
 *   [1, 8, 9, 4, 13, 5, 12, 2, 7, 10, 3, 6, 11]
 */
export function compressedSeedOrder(n) {
    if (n <= 0)
        return [];
    if (n === 1)
        return [1];
    const order = generateSeedOrder(nextPowerOf2(n));
    return order.filter(seed => seed <= n);
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
export function computeLosersBracketShape(playerCount) {
    if (playerCount < 2)
        return [];
    const wbCounts = computeRoundCounts(playerCount);
    const wbRounds = wbCounts.length;
    if (wbRounds < 2)
        return []; // N=2: no LB rounds.
    const lbRounds = 2 * (wbRounds - 1);
    const info = [];
    let prevAdvances = 0;
    for (let r = 1; r <= lbRounds; r++) {
        let isDropIn;
        let wbLoserFeedRound;
        if (r === 1) {
            isDropIn = true;
            wbLoserFeedRound = 1;
        }
        else if (r % 2 === 0) {
            isDropIn = true;
            wbLoserFeedRound = r / 2 + 1;
        }
        else {
            isDropIn = false;
            wbLoserFeedRound = null;
        }
        const carryover = r === 1 ? 0 : prevAdvances;
        const dropIn = wbLoserFeedRound !== null ? (wbCounts[wbLoserFeedRound - 1] ?? 0) : 0;
        const alive = carryover + dropIn;
        const matches = Math.floor(alive / 2);
        const byes = alive % 2;
        const advances = matches + byes;
        info.push({
            round: r,
            isDropIn,
            carryover,
            dropIn,
            alive,
            matches,
            byes,
            advances,
            wbLoserFeedRound,
        });
        prevAdvances = advances;
    }
    return info;
}
/**
 * @deprecated — kept for backwards compatibility / experimentation. Use
 * `compressedSeedOrder` for slot-based seeding.
 *
 * Pair `n` players (passed as ranks 1..n where rank 1 = top seed) into
 * `floor(n/2)` R1 matches arranged top-to-bottom in standard SE bracket
 * position order. If `n` is odd, rank 1 byes and is appended to the end.
 */
export function standardRankPairing(n) {
    if (n === 0)
        return [];
    if (n === 1)
        return [1];
    if (n === 2)
        return [1, 2];
    const bracketSize = nextPowerOf2(n);
    const order = generateSeedOrder(bracketSize);
    const slots = [];
    for (let i = 0; i < bracketSize; i += 2) {
        const pos = i / 2 + 1;
        const a = order[i];
        const b = order[i + 1];
        const aReal = a <= n;
        const bReal = b <= n;
        if (aReal && bReal) {
            slots.push({ kind: 'pair', a, b, pos });
        }
        else if (aReal) {
            slots.push({ kind: 'loner', rank: a, pos });
        }
        else if (bReal) {
            slots.push({ kind: 'loner', rank: b, pos });
        }
        // else both phantom: skip entirely
    }
    const realPairs = slots.filter((s) => s.kind === 'pair');
    const loners = slots.filter((s) => s.kind === 'loner');
    let byeRank = null;
    let loneList = loners;
    if (n % 2 === 1) {
        // Top seed (rank 1) byes. Find the loner with rank 1 and remove it.
        const idx = loneList.findIndex(l => l.rank === 1);
        if (idx >= 0) {
            byeRank = 1;
            loneList = [...loneList.slice(0, idx), ...loneList.slice(idx + 1)];
        }
        else {
            // Rank 1 wasn't a loner — shouldn't normally happen for typical n, but
            // handle it by byeing rank 1 anyway and finding it inside a pair.
            // (Degenerate case; we don't expect this path.)
        }
    }
    // Pair remaining loners standardly: sort by rank, then pair top-vs-bottom.
    const sortedByRank = [...loneList].sort((a, b) => a.rank - b.rank);
    const lonerPairs = [];
    let lo = 0;
    let hi = sortedByRank.length - 1;
    while (lo < hi) {
        const A = sortedByRank[lo];
        const B = sortedByRank[hi];
        // Place the loner pair at the source position of its lowest-ranked
        // member (the position rank-A originally occupied). This keeps top
        // seeds anchored to their original bracket region.
        lonerPairs.push({ a: A.rank, b: B.rank, pos: A.pos, priority: 0 });
        lo++;
        hi--;
    }
    // Combine real pairs and loner pairs; sort by position. On position ties,
    // loner pairs (priority 0) come first — they own their original slot.
    const allPairs = [
        ...realPairs.map(p => ({ a: p.a, b: p.b, pos: p.pos, priority: 1 })),
        ...lonerPairs,
    ];
    allPairs.sort((x, y) => x.pos - y.pos || x.priority - y.priority);
    const result = [];
    for (const p of allPairs) {
        result.push(p.a, p.b);
    }
    if (byeRank !== null) {
        result.push(byeRank);
    }
    return result;
}
//# sourceMappingURL=utils.js.map