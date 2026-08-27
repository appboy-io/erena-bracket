import { nextPowerOf2, calculateRounds, generateMatchId, slotsFromSeeding, } from './utils.js';
import { planEntryShape, EntryShapeError } from './losers-entry.js';
/**
 * Generate a double elimination bracket
 *
 * Structure:
 * - Winners bracket: Standard single elimination
 * - Losers bracket: Losers from winners drop down
 * - Grand finals: Winners bracket winner vs Losers bracket winner
 */
export function generateDoubleElimination(options) {
    const { tournamentId, participants, grandFinalReset = true } = options;
    if (participants.length < 2) {
        throw new Error('Need at least 2 participants for a bracket');
    }
    const bracketSize = nextPowerOf2(participants.length);
    const slots = slotsFromSeeding(participants, bracketSize);
    return buildDoubleElimination(tournamentId, slots, grandFinalReset);
}
/** Build a double-elim bracket (winners + losers + grand final) from an explicit
 *  round-1 slot array (length must be a power of two). slots[i] is the
 *  participant in round-1 slot i, or null (bye). */
export function buildDoubleElimination(tournamentId, slots, grandFinalReset = true) {
    const bracketSize = slots.length;
    const winnersRounds = calculateRounds(bracketSize);
    const realCount = slots.filter((s) => s !== null).length;
    const matches = [];
    // Generate Winners Bracket
    generateWinnersBracket(matches, tournamentId, bracketSize, winnersRounds, slots);
    // Generate Losers Bracket
    generateLosersBracket(matches, tournamentId, bracketSize, winnersRounds);
    // Generate Grand Finals
    generateGrandFinals(matches, tournamentId, winnersRounds, grandFinalReset);
    // Link winners bracket losers to losers bracket
    linkWinnersToLosers(matches, tournamentId, winnersRounds, bracketSize);
    // Update statuses
    propagateByes(matches);
    updateMatchStatuses(matches);
    // Calculate total rounds (winners + losers rounds + grand finals)
    const losersRounds = (winnersRounds - 1) * 2;
    const totalRounds = winnersRounds + losersRounds + (grandFinalReset ? 2 : 1);
    return {
        tournamentId,
        format: 'double_elim',
        matches,
        totalRounds,
        participantCount: realCount,
    };
}
function generateWinnersBracket(matches, tournamentId, bracketSize, totalRounds, slots) {
    // Generate all rounds
    for (let round = 1; round <= totalRounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        for (let position = 1; position <= matchesInRound; position++) {
            const matchId = generateMatchId(tournamentId, 'winners', round, position);
            let nextMatchId = null;
            let nextMatchSlot = null;
            if (round < totalRounds) {
                const nextPosition = Math.ceil(position / 2);
                nextMatchId = generateMatchId(tournamentId, 'winners', round + 1, nextPosition);
                nextMatchSlot = position % 2 === 1 ? 1 : 2;
            }
            const match = {
                id: matchId,
                round,
                position,
                bracketType: 'winners',
                participant1: null,
                participant2: null,
                participant1Seed: null,
                participant2Seed: null,
                winner: null,
                status: 'pending',
                nextMatchId,
                nextMatchSlot,
                loserNextMatchId: null,
                loserNextMatchSlot: null,
            };
            matches.push(match);
        }
    }
    // Populate first round
    const firstRoundMatches = matches.filter(m => m.round === 1 && m.bracketType === 'winners');
    for (let i = 0; i < firstRoundMatches.length; i++) {
        const match = firstRoundMatches[i];
        const p1 = slots[i * 2] ?? undefined;
        const p2 = slots[i * 2 + 1] ?? undefined;
        if (p1 && !p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.winner = p1.id;
            match.status = 'bye';
            if (match.nextMatchId) {
                advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p1.id, p1.seed);
            }
        }
        else if (p2 && !p1) {
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.winner = p2.id;
            match.status = 'bye';
            if (match.nextMatchId) {
                advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p2.id, p2.seed);
            }
        }
        else if (p1 && p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.status = 'ready';
        }
        // both null: leave pending (dead slot)
    }
}
function generateLosersBracket(matches, tournamentId, bracketSize, winnersRounds) {
    // Losers bracket has (winnersRounds - 1) * 2 rounds
    // Each winners round (except finals) feeds into losers bracket
    // Losers bracket alternates between:
    // - Rounds where losers from winners drop in
    // - Rounds where only losers bracket participants play
    const losersRounds = (winnersRounds - 1) * 2;
    let currentLosersMatchCount = bracketSize / 4; // First losers round has half of first winners round
    for (let lRound = 1; lRound <= losersRounds; lRound++) {
        const isDropInRound = lRound % 2 === 1;
        // Calculate matches in this round
        let matchesInRound;
        if (isDropInRound) {
            // Drop-in rounds: same as previous round (losers drop in)
            matchesInRound = currentLosersMatchCount;
        }
        else {
            // Reduction rounds: halve the matches
            matchesInRound = currentLosersMatchCount;
            currentLosersMatchCount = Math.max(1, currentLosersMatchCount / 2);
        }
        // Ensure at least 1 match
        matchesInRound = Math.max(1, matchesInRound);
        for (let position = 1; position <= matchesInRound; position++) {
            const matchId = generateMatchId(tournamentId, 'losers', lRound, position);
            let nextMatchId = null;
            let nextMatchSlot = null;
            if (lRound < losersRounds) {
                if (lRound % 2 === 0) {
                    // After reduction round, feeds into next drop-in round
                    const nextPosition = Math.ceil(position / 2);
                    nextMatchId = generateMatchId(tournamentId, 'losers', lRound + 1, nextPosition);
                    nextMatchSlot = position % 2 === 1 ? 1 : 2;
                }
                else {
                    // After drop-in round, feeds directly into reduction round
                    nextMatchId = generateMatchId(tournamentId, 'losers', lRound + 1, position);
                    nextMatchSlot = 1; // Winner of drop-in round takes slot 1
                }
            }
            const match = {
                id: matchId,
                round: lRound,
                position,
                bracketType: 'losers',
                participant1: null,
                participant2: null,
                participant1Seed: null,
                participant2Seed: null,
                winner: null,
                status: 'pending',
                nextMatchId,
                nextMatchSlot,
                loserNextMatchId: null, // Losers bracket losers are eliminated
                loserNextMatchSlot: null,
            };
            matches.push(match);
        }
        // Update count for next iteration
        if (!isDropInRound) {
            currentLosersMatchCount = Math.max(1, matchesInRound / 2);
        }
    }
}
function generateGrandFinals(matches, tournamentId, winnersRounds, grandFinalReset) {
    // Grand Finals Match 1
    const gf1Id = generateMatchId(tournamentId, 'grand_final', 1, 1);
    const gf1 = {
        id: gf1Id,
        round: 1,
        position: 1,
        bracketType: 'grand_final',
        participant1: null, // Winners bracket winner
        participant2: null, // Losers bracket winner
        participant1Seed: null,
        participant2Seed: null,
        winner: null,
        status: 'pending',
        nextMatchId: grandFinalReset ? generateMatchId(tournamentId, 'grand_final', 2, 1) : null,
        nextMatchSlot: null, // Special handling for grand finals
        loserNextMatchId: grandFinalReset ? generateMatchId(tournamentId, 'grand_final', 2, 1) : null,
        loserNextMatchSlot: null,
    };
    matches.push(gf1);
    // Grand Finals Reset (if enabled)
    if (grandFinalReset) {
        const gf2Id = generateMatchId(tournamentId, 'grand_final', 2, 1);
        const gf2 = {
            id: gf2Id,
            round: 2,
            position: 1,
            bracketType: 'grand_final',
            participant1: null,
            participant2: null,
            participant1Seed: null,
            participant2Seed: null,
            winner: null,
            status: 'pending',
            nextMatchId: null,
            nextMatchSlot: null,
            loserNextMatchId: null,
            loserNextMatchSlot: null,
        };
        matches.push(gf2);
    }
    // Link winners finals to grand finals
    const winnersFinalsId = generateMatchId(tournamentId, 'winners', winnersRounds, 1);
    const winnersFinals = matches.find(m => m.id === winnersFinalsId);
    if (winnersFinals) {
        winnersFinals.nextMatchId = gf1Id;
        winnersFinals.nextMatchSlot = 1;
    }
    // Link losers finals to grand finals
    const losersRounds = (winnersRounds - 1) * 2;
    const losersFinalsId = generateMatchId(tournamentId, 'losers', losersRounds, 1);
    const losersFinals = matches.find(m => m.id === losersFinalsId);
    if (losersFinals) {
        losersFinals.nextMatchId = gf1Id;
        losersFinals.nextMatchSlot = 2;
    }
}
const CROSSOVER_PERMS = {
    // seat order unchanged
    identity: (pos) => pos - 1,
    // last dropper takes the first seat
    reverse: (pos, c) => c - pos,
    // top half and bottom half trade places
    halfswap: (pos, c) => (pos <= c / 2 ? pos + c / 2 : pos - c / 2) - 1,
    // half-swap, then reversed
    revhalf: (pos, c) => {
        const h = c / 2;
        return c - (pos <= h ? pos + h : pos - h);
    },
};
const CROSSOVER_PLAN = {
    3: ['reverse'],
    4: ['reverse', 'identity'],
    5: ['reverse', 'revhalf', 'reverse'],
    6: ['reverse', 'halfswap', 'revhalf', 'reverse'],
    7: ['reverse', 'revhalf', 'halfswap', 'identity', 'reverse'],
    8: ['reverse', 'halfswap', 'revhalf', 'identity', 'reverse', 'identity'],
    9: ['reverse', 'revhalf', 'halfswap', 'identity', 'reverse', 'revhalf', 'reverse'],
};
/** Permutation for winners round `wRound` (>= 2) in a bracket of `bracketSize`.
 *  Beyond 512 players there is no searched plan, so fall back to plain reversal. */
function crossoverFor(bracketSize, wRound) {
    const plan = CROSSOVER_PLAN[Math.log2(bracketSize)];
    const name = plan?.[wRound - 2];
    return (name && CROSSOVER_PERMS[name]) || CROSSOVER_PERMS['reverse'];
}
/**
 * Crossover plans for a losers bracket seeded with direct entrants.
 *
 * CROSSOVER_PLAN above assumes the losers bracket starts empty and does not
 * carry over. That is false here: entry rounds put players in it who never
 * played this phase's winners bracket, which changes which pairs can collide.
 * Re-derived with `scripts/crossover-search.mjs entry <k> <L>`; see
 * docs/losers-crossover.md for the numbers.
 *
 * Note winners round 1 appears here and does not appear in CROSSOVER_PLAN. In a
 * standard bracket its losers pair against each other on fixed geometry; here
 * each merges against a surviving direct entrant, so the seat is a free choice
 * worth up to two rounds of separation.
 *
 * Keyed "{winnersBracketSize}x{directEntrants}". Only the four shapes the
 * exhaustive search can actually solve are listed: winners brackets of 32+
 * make the search intractable, because at that size it must also permute
 * winners round 1 (16! and up) alongside every later round -- see
 * docs/losers-crossover.md for the arithmetic. A shape with no entry falls
 * back to identity via `entryCrossoverNameFor` below, which is safe but not
 * necessarily optimal.
 */
export const ENTRY_CROSSOVER_PLAN = {
    '8x8': ['identity', 'reverse', 'identity'],
    '8x16': ['identity', 'reverse', 'identity'],
    '16x16': ['identity', 'halfswap', 'identity', 'identity'],
    '16x32': ['identity', 'halfswap', 'identity', 'identity'],
};
/**
 * Permutation name for winners round `wRound` (>= 1) when the losers bracket
 * starts seeded with `directEntrants` entrants. Falls back to `'identity'`
 * for any shape the search hasn't solved -- safe, but potentially up to two
 * rounds short of optimal separation (see docs/losers-crossover.md).
 */
export function entryCrossoverNameFor(bracketSize, directEntrants, wRound) {
    const plan = ENTRY_CROSSOVER_PLAN[`${bracketSize}x${directEntrants}`];
    return plan?.[wRound - 1] ?? 'identity';
}
function linkWinnersToLosers(matches, tournamentId, winnersRounds, bracketSize) {
    // Special case: 2-player tournament (winnersRounds === 1)
    // There are no losers bracket matches - the loser goes directly to grand finals slot 2
    if (winnersRounds === 1) {
        const winnersFinalsMatch = matches.find(m => m.bracketType === 'winners' && m.round === 1);
        const grandFinalsMatch = matches.find(m => m.bracketType === 'grand_final' && m.round === 1);
        if (winnersFinalsMatch && grandFinalsMatch) {
            winnersFinalsMatch.loserNextMatchId = grandFinalsMatch.id;
            winnersFinalsMatch.loserNextMatchSlot = 2;
        }
        return;
    }
    // Link losers from each winners round to appropriate losers bracket round
    // Winners Round 1 losers -> Losers Round 1
    // Winners Round 2 losers -> Losers Round 2 (as slot 2, drop-ins)
    // Winners Round 3 losers -> Losers Round 4 (as slot 2, drop-ins)
    // etc.
    for (let wRound = 1; wRound < winnersRounds; wRound++) {
        const winnersMatches = matches.filter(m => m.bracketType === 'winners' && m.round === wRound);
        // Calculate which losers round this feeds into
        let losersRound;
        if (wRound === 1) {
            losersRound = 1;
        }
        else {
            // Each subsequent winners round feeds into losers round 2, 4, 6, etc.
            losersRound = wRound * 2 - 2;
        }
        const losersMatches = matches.filter(m => m.bracketType === 'losers' && m.round === losersRound);
        if (wRound >= 2) {
            // Crossover drop: WB round-r losers (slot 2) are placed into that round's
            // losers seats through a permutation chosen per bracket size — see
            // CROSSOVER_PLAN and the note above it.
            const seats = [...losersMatches].sort((a, b) => a.position - b.position);
            const droppers = [...winnersMatches].sort((a, b) => a.position - b.position);
            const permute = crossoverFor(bracketSize, wRound);
            droppers.forEach((wm, i) => {
                wm.loserNextMatchId = seats[permute(i + 1, seats.length)].id;
                wm.loserNextMatchSlot = 2;
            });
            continue; // whole round handled; skip the per-match loop below
        }
        // Link winners matches to losers matches
        for (let i = 0; i < winnersMatches.length; i++) {
            const winnersMatch = winnersMatches[i];
            // Determine which losers match this feeds into
            let losersMatchIndex;
            let slot;
            if (wRound === 1) {
                // First round: 2 winners matches feed into 1 losers match
                losersMatchIndex = Math.floor(i / 2);
                slot = (i % 2 === 0) ? 1 : 2;
            }
            else {
                // Later rounds: 1 winners match feeds into 1 losers match as slot 2
                losersMatchIndex = i;
                slot = 2;
            }
            const losersMatch = losersMatches[losersMatchIndex];
            if (losersMatch) {
                winnersMatch.loserNextMatchId = losersMatch.id;
                winnersMatch.loserNextMatchSlot = slot;
            }
        }
    }
    // Link Winners Finals loser to Losers Finals (slot 2)
    // The loop above doesn't process the final winners round
    const losersRounds = (winnersRounds - 1) * 2;
    const winnersFinalsMatch = matches.find(m => m.bracketType === 'winners' && m.round === winnersRounds);
    const losersFinalsMatch = matches.find(m => m.bracketType === 'losers' && m.round === losersRounds);
    if (winnersFinalsMatch && losersFinalsMatch) {
        winnersFinalsMatch.loserNextMatchId = losersFinalsMatch.id;
        winnersFinalsMatch.loserNextMatchSlot = 2;
    }
}
function advanceToMatch(matches, matchId, slot, participantId, seed) {
    const match = matches.find(m => m.id === matchId);
    if (!match)
        return;
    if (slot === 1) {
        match.participant1 = participantId;
        match.participant1Seed = seed;
    }
    else {
        match.participant2 = participantId;
        match.participant2Seed = seed;
    }
}
function updateMatchStatuses(matches) {
    for (const match of matches) {
        if (match.status === 'bye' || match.status === 'completed')
            continue;
        if (match.participant1 && match.participant2) {
            match.status = 'ready';
        }
        else {
            match.status = 'pending';
        }
    }
}
/**
 * Resolve "phantom" byes: a match slot can never be filled when its feeder is a
 * bye (winners-bracket bye → no loser) or a dead double-bye (→ no winner).
 * - one real player + one phantom slot → that player walks over (status 'bye', advance).
 * - both slots phantom → the match itself is dead (status 'bye', winner null, advances nobody).
 * Idempotent; iterates to a fixpoint so cascades resolve. Safe to call repeatedly.
 */
export function propagateByes(matches) {
    const key = (id, slot) => `${id}#${slot}`;
    const feeders = new Map();
    for (const m of matches) {
        if (m.nextMatchId && m.nextMatchSlot)
            feeders.set(key(m.nextMatchId, m.nextMatchSlot), { match: m, kind: 'winner' });
        if (m.loserNextMatchId && m.loserNextMatchSlot)
            feeders.set(key(m.loserNextMatchId, m.loserNextMatchSlot), { match: m, kind: 'loser' });
    }
    const slotDead = (target, slot) => {
        const f = feeders.get(key(target.id, slot));
        if (!f)
            return false; // seeded source slot (e.g. winners R1) — never phantom
        return f.kind === 'loser' ? f.match.status === 'bye' : f.match.status === 'bye' && !f.match.winner;
    };
    let progressed = true;
    while (progressed) {
        progressed = false;
        for (const m of matches) {
            if (m.status === 'completed' || m.status === 'bye')
                continue;
            const d1 = slotDead(m, 1);
            const d2 = slotDead(m, 2);
            if (m.participant1 && d2) {
                m.status = 'bye';
                m.winner = m.participant1;
                if (m.nextMatchId && m.nextMatchSlot)
                    advanceToMatch(matches, m.nextMatchId, m.nextMatchSlot, m.participant1, m.participant1Seed ?? 0);
                progressed = true;
            }
            else if (m.participant2 && d1) {
                m.status = 'bye';
                m.winner = m.participant2;
                if (m.nextMatchId && m.nextMatchSlot)
                    advanceToMatch(matches, m.nextMatchId, m.nextMatchSlot, m.participant2, m.participant2Seed ?? 0);
                progressed = true;
            }
            else if (d1 && d2) {
                m.status = 'bye';
                m.winner = null; // dead double-bye
                progressed = true;
            }
        }
    }
}
/**
 * Report a match result in double elimination
 */
export function reportDoubleElimMatchResult(bracket, matchId, winnerId) {
    const matches = bracket.matches.map(m => ({ ...m }));
    const match = matches.find(m => m.id === matchId);
    if (!match) {
        throw new Error(`Match ${matchId} not found`);
    }
    if (match.participant1 !== winnerId && match.participant2 !== winnerId) {
        throw new Error(`Winner ${winnerId} is not a participant in match ${matchId}`);
    }
    const loserId = match.participant1 === winnerId ? match.participant2 : match.participant1;
    const winnerSeed = match.participant1 === winnerId ? match.participant1Seed : match.participant2Seed;
    const loserSeed = match.participant1 === winnerId ? match.participant2Seed : match.participant1Seed;
    match.winner = winnerId;
    match.status = 'completed';
    // Advance winner
    if (match.nextMatchId && winnerSeed !== null) {
        // Special handling for grand finals
        if (match.bracketType === 'grand_final' && match.round === 1) {
            // If winners bracket player wins GF1, tournament is over
            // If losers bracket player wins GF1, we go to reset
            const gf2 = matches.find(m => m.bracketType === 'grand_final' && m.round === 2);
            if (gf2) {
                if (match.participant1 === winnerId) {
                    // Winners bracket player won - they win the tournament
                    // GF2 is not needed
                    gf2.status = 'bye';
                }
                else {
                    // Losers bracket player won - reset needed
                    gf2.participant1 = match.participant1; // Original winners bracket player
                    gf2.participant1Seed = match.participant1Seed;
                    gf2.participant2 = winnerId;
                    gf2.participant2Seed = winnerSeed;
                    gf2.status = 'ready';
                }
            }
        }
        else {
            advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, winnerId, winnerSeed);
        }
    }
    // Send loser to losers bracket (if applicable)
    // Skip for grand finals - they have special handling above
    if (match.loserNextMatchId && loserId && loserSeed !== null && match.bracketType !== 'grand_final') {
        advanceToMatch(matches, match.loserNextMatchId, match.loserNextMatchSlot, loserId, loserSeed);
    }
    propagateByes(matches);
    updateMatchStatuses(matches);
    return {
        ...bracket,
        matches,
    };
}
/* ---------------------------------------------------------------------------
 * Double elimination with entrants seeded straight into the losers bracket.
 *
 * A pools phase sends its pool winners into the winners bracket and its
 * runners-up into losers, already carrying a loss. The losers bracket therefore
 * starts populated, which changes its shape at the front: entry rounds halve
 * the direct entrants until they equal the winners round-1 loser count, and
 * only then does the ordinary alternating merge/reduce pattern resume.
 *
 *   Top 24 -- winners bracket of 8, 16 direct into losers
 *     LR1  8   entry, 16 -> 8         LR2  4   entry, 8 -> 4
 *     LR3  4   merge, WR1's 4 losers  LR4  2   reduce
 *     LR5  2   merge, WR2's 2 losers  LR6  1   reduce
 *     LR7  1   merge, WR3's loser (the losers final)
 *   22 matches + the grand final = 23 = 24 - 1 eliminations.
 *
 * Entry rounds are ordinary losers rounds, so no new bracket type is introduced
 * and everything downstream shifts by the entry-round count. Connector geometry
 * downstream is derived from nextMatchId, so these brackets render with no
 * display-side work.
 *
 * buildDoubleElimination and CROSSOVER_PLAN above are deliberately untouched:
 * empty-losers brackets are proven optimal at 16 and 32 and must stay
 * bit-identical.
 * ------------------------------------------------------------------------- */
/** Build a double-elim bracket in which `losersEntrants` start in the losers
 *  bracket. `winnersSlots` is the winners round-1 slot array (length a power of
 *  two, null for a bye); `losersEntrants` must be the winners round-1 loser
 *  count times a power of two, or the shape cannot reduce cleanly. */
export function buildDoubleEliminationWithEntry(tournamentId, winnersSlots, losersEntrants, grandFinalReset = true) {
    const bracketSize = winnersSlots.length;
    const directEntrants = losersEntrants.length;
    // Throws for a winners bracket that is not a power of two, or an entrant
    // count that cannot halve down to the winners round-1 loser count.
    const shape = planEntryShape(bracketSize, directEntrants);
    const { winnersRounds, losersRounds } = shape;
    // With no entry rounds, losers round 1 IS the first merge round: the entrant
    // holds slot 1 and the winners round-1 dropper arrives in slot 2. A missing
    // entrant is therefore not a bye anyone can walk -- the dropper would sit in a
    // match that can never be resolved, and the whole losers bracket behind it
    // stalls. Entry rounds absorb the gap fine (seatDirectEntrants walks the lone
    // entrant over), so this only bites when directEntrants === bracketSize / 2.
    // Compacting the list instead would silently shift every crossover seat.
    if (shape.entryRounds === 0 && losersEntrants.some(entrant => !entrant)) {
        throw new EntryShapeError('a bracket with no entry rounds cannot give a direct entrant a bye; ' +
            'supply a full entrant list');
    }
    const matches = [];
    generateWinnersBracket(matches, tournamentId, bracketSize, winnersRounds, winnersSlots);
    // Grand finals BEFORE the losers bracket, on purpose. generateGrandFinals
    // links the losers final by the standard round number, (winnersRounds-1)*2,
    // which here is an ordinary mid-bracket round -- letting it run last would
    // point that round's first match at the grand final. Running it while the
    // losers bracket does not exist leaves the lookup empty, and the losers
    // generator below points the real losers final at the grand final itself.
    generateGrandFinals(matches, tournamentId, winnersRounds, grandFinalReset);
    generateEntryLosersBracket(matches, tournamentId, bracketSize, shape);
    seatDirectEntrants(matches, shape, losersEntrants);
    linkWinnersToEntryLosers(matches, bracketSize, directEntrants, shape);
    propagateByes(matches);
    updateMatchStatuses(matches);
    const realCount = winnersSlots.filter((s) => s !== null).length +
        losersEntrants.filter((s) => s !== null).length;
    return {
        tournamentId,
        format: 'double_elim',
        // winners, losers, grand final -- the order buildDoubleElimination emits.
        matches: [
            ...matches.filter(m => m.bracketType === 'winners'),
            ...matches.filter(m => m.bracketType === 'losers'),
            ...matches.filter(m => m.bracketType === 'grand_final'),
        ],
        totalRounds: winnersRounds + losersRounds + (grandFinalReset ? 2 : 1),
        participantCount: realCount,
    };
}
/** Matches in each losers round, LR1 first: the entry rounds, then the standard
 *  alternating merge/reduce pattern starting from bracketSize / 2. */
function entryLosersRoundSizes(bracketSize, shape) {
    const counts = [...shape.entryMatchesPerRound];
    for (let s = 1; s <= shape.losersRounds - shape.entryRounds; s++) {
        counts.push(s % 2 === 1
            // merge round: takes the losers of winners round (s+1)/2
            ? bracketSize / Math.pow(2, (s + 1) / 2)
            // reduce round: halves the merge round before it
            : bracketSize / Math.pow(2, s / 2 + 1));
    }
    return counts;
}
function generateEntryLosersBracket(matches, tournamentId, bracketSize, shape) {
    const counts = entryLosersRoundSizes(bracketSize, shape);
    const grandFinalId = generateMatchId(tournamentId, 'grand_final', 1, 1);
    for (let lRound = 1; lRound <= shape.losersRounds; lRound++) {
        const matchesInRound = counts[lRound - 1];
        const nextCount = counts[lRound] ?? 0;
        // A round that keeps its match count feeds the next one 1:1 (its winner
        // takes slot 1 and meets a dropper); a round that halves pairs up.
        const feedsOneToOne = nextCount === matchesInRound;
        for (let position = 1; position <= matchesInRound; position++) {
            let nextMatchId;
            let nextMatchSlot;
            if (lRound === shape.losersRounds) {
                nextMatchId = grandFinalId;
                nextMatchSlot = 2;
            }
            else if (feedsOneToOne) {
                nextMatchId = generateMatchId(tournamentId, 'losers', lRound + 1, position);
                nextMatchSlot = 1;
            }
            else {
                nextMatchId = generateMatchId(tournamentId, 'losers', lRound + 1, Math.ceil(position / 2));
                nextMatchSlot = position % 2 === 1 ? 1 : 2;
            }
            matches.push({
                id: generateMatchId(tournamentId, 'losers', lRound, position),
                round: lRound,
                position,
                bracketType: 'losers',
                participant1: null,
                participant2: null,
                participant1Seed: null,
                participant2Seed: null,
                winner: null,
                status: 'pending',
                nextMatchId,
                nextMatchSlot,
                loserNextMatchId: null, // losers bracket losers are eliminated
                loserNextMatchSlot: null,
            });
        }
    }
}
/** Seat the direct entrants into losers round 1. With entry rounds that round is
 *  entrants only, so they pair off; with none it is already the first merge
 *  round, so each entrant takes slot 1 and waits for a dropper. */
function seatDirectEntrants(matches, shape, losersEntrants) {
    const round1 = matches
        .filter(m => m.bracketType === 'losers' && m.round === 1)
        .sort((a, b) => a.position - b.position);
    if (shape.entryRounds === 0) {
        round1.forEach((match, i) => {
            const entrant = losersEntrants[i];
            if (entrant) {
                match.participant1 = entrant.id;
                match.participant1Seed = entrant.seed;
            }
        });
        return;
    }
    round1.forEach((match, i) => {
        const p1 = losersEntrants[i * 2] ?? undefined;
        const p2 = losersEntrants[i * 2 + 1] ?? undefined;
        if (p1 && !p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.winner = p1.id;
            match.status = 'bye';
            advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p1.id, p1.seed);
        }
        else if (p2 && !p1) {
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.winner = p2.id;
            match.status = 'bye';
            advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p2.id, p2.seed);
        }
        else if (p1 && p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.status = 'ready';
        }
        // both null: leave pending (dead slot)
    });
}
/** Winners round r drops into losers round entryRounds + 2r - 1 -- every merge
 *  round, including the winners final into the losers final. The dropper and
 *  seat counts are equal by construction, and which seat each dropper takes is
 *  ENTRY_CROSSOVER_PLAN's business (see the note above it). */
function linkWinnersToEntryLosers(matches, bracketSize, directEntrants, shape) {
    for (let wRound = 1; wRound <= shape.winnersRounds; wRound++) {
        const lRound = shape.entryRounds + 2 * wRound - 1;
        const droppers = matches
            .filter(m => m.bracketType === 'winners' && m.round === wRound)
            .sort((a, b) => a.position - b.position);
        const seats = matches
            .filter(m => m.bracketType === 'losers' && m.round === lRound)
            .sort((a, b) => a.position - b.position);
        const name = entryCrossoverNameFor(bracketSize, directEntrants, wRound);
        const permute = CROSSOVER_PERMS[name] ?? CROSSOVER_PERMS['identity'];
        droppers.forEach((wm, i) => {
            const seat = seats[permute(i + 1, seats.length)];
            if (!seat)
                return;
            wm.loserNextMatchId = seat.id;
            wm.loserNextMatchSlot = 2;
        });
    }
}
//# sourceMappingURL=double-elimination.js.map