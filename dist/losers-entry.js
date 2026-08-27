/**
 * Entry-round arithmetic for a losers bracket seeded with direct entrants.
 *
 * A pools phase can send its runners-up straight into losers. Those entrants
 * cannot simply be dropped anywhere: the losers bracket has an invariant that
 * entering each drop round, the survivor count equals the incoming drop count.
 * Winners round 1 produces bracketSize/2 losers, so the direct entrants must be
 * halved until they reach that number. Each halving is one entry round.
 *
 *   Top 24 — winners bracket of 8, 16 direct into losers
 *     LE1   8 matches   16 -> 8
 *     LE2   4 matches    8 -> 4
 *     then 4 survivors meet the 4 winners-round-1 losers, and the ordinary
 *     alternating merge/reduce pattern takes over unchanged.
 *
 * Sanity check for any shape: a double elim of N players needs N-1
 * eliminations; only losers matches and the grand final eliminate.
 */
export class EntryShapeError extends Error {
}
function isPowerOfTwo(n) {
    return n > 0 && (n & (n - 1)) === 0;
}
/**
 * @param bracketSize    size of the WINNERS bracket, a power of two
 * @param directEntrants how many entrants start in the losers bracket
 */
export function planEntryShape(bracketSize, directEntrants) {
    if (!isPowerOfTwo(bracketSize) || bracketSize < 2) {
        throw new EntryShapeError(`winners bracket size must be a power of two, got ${bracketSize}`);
    }
    const wr1Losers = bracketSize / 2;
    if (directEntrants < wr1Losers) {
        throw new EntryShapeError(`need at least ${wr1Losers} direct entrants to merge against winners round 1, got ${directEntrants}`);
    }
    const ratio = directEntrants / wr1Losers;
    if (!Number.isInteger(ratio) || !isPowerOfTwo(ratio)) {
        throw new EntryShapeError(`${directEntrants} cannot reduce cleanly to ${wr1Losers}; ` +
            `the direct-entrant count must be ${wr1Losers} times a power of two`);
    }
    const winnersRounds = Math.log2(bracketSize);
    const entryRounds = Math.log2(ratio);
    const entryMatchesPerRound = [];
    let remaining = directEntrants;
    for (let i = 0; i < entryRounds; i++) {
        entryMatchesPerRound.push(remaining / 2);
        remaining /= 2;
    }
    return {
        winnersRounds,
        entryRounds,
        entryMatchesPerRound,
        losersRounds: entryRounds + 2 * (winnersRounds - 1),
    };
}
//# sourceMappingURL=losers-entry.js.map