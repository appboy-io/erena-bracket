import { nextPowerOf2, calculateRounds, generateMatchId, generateSeedOrder, assignByes, } from './utils.js';
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
    const participantCount = participants.length;
    if (participantCount < 2) {
        throw new Error('Need at least 2 participants for a bracket');
    }
    const bracketSize = nextPowerOf2(participantCount);
    const winnersRounds = calculateRounds(bracketSize);
    const seedOrder = generateSeedOrder(bracketSize);
    const byeSeeds = assignByes(participantCount, bracketSize);
    // Create participant lookup by seed
    const participantBySeed = new Map();
    for (const p of participants) {
        participantBySeed.set(p.seed, p);
    }
    const matches = [];
    // Generate Winners Bracket
    generateWinnersBracket(matches, tournamentId, bracketSize, winnersRounds, seedOrder, byeSeeds, participantBySeed);
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
        participantCount,
    };
}
function generateWinnersBracket(matches, tournamentId, bracketSize, totalRounds, seedOrder, byeSeeds, participantBySeed) {
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
        const seed1 = seedOrder[i * 2];
        const seed2 = seedOrder[i * 2 + 1];
        const p1 = participantBySeed.get(seed1);
        const p2 = participantBySeed.get(seed2);
        const p1HasBye = byeSeeds.has(seed1);
        const p2HasBye = byeSeeds.has(seed2);
        if (p1HasBye && !p2HasBye) {
            match.participant2 = p2?.id ?? null;
            match.participant2Seed = seed2;
            match.winner = p2?.id ?? null;
            match.status = 'bye';
            if (match.nextMatchId && p2) {
                advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p2.id, seed2);
            }
        }
        else if (p2HasBye && !p1HasBye) {
            match.participant1 = p1?.id ?? null;
            match.participant1Seed = seed1;
            match.winner = p1?.id ?? null;
            match.status = 'bye';
            if (match.nextMatchId && p1) {
                advanceToMatch(matches, match.nextMatchId, match.nextMatchSlot, p1.id, seed1);
            }
        }
        else if (!p1HasBye && !p2HasBye) {
            match.participant1 = p1?.id ?? null;
            match.participant1Seed = seed1;
            match.participant2 = p2?.id ?? null;
            match.participant2Seed = seed2;
            match.status = 'ready';
        }
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
// Winners-bracket match IDs that can reach (matchId, slot) via any feed path.
// Used to place WB losers opposite players they haven't met.
function winnersAncestry(matches, matchId, slot) {
    const acc = new Set();
    const feeders = matches.filter((m) => (m.nextMatchId === matchId && m.nextMatchSlot === slot) ||
        (m.loserNextMatchId === matchId && m.loserNextMatchSlot === slot));
    for (const f of feeders) {
        if (f.bracketType === 'winners') {
            acc.add(f.id);
        }
        else {
            for (const s of [1, 2]) {
                for (const id of winnersAncestry(matches, f.id, s))
                    acc.add(id);
            }
        }
    }
    return acc;
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
            // Ancestry-disjoint drop: each WB round-r loser (slot 2) is placed into a
            // losers match whose sitting player (slot 1) came from a different WB path,
            // so the two never met. Winners rounds are linked in increasing order, so by
            // the time round r is placed, all earlier drops (and thus slot-1 ancestries)
            // are already set.
            const sortedLosers = [...losersMatches].sort((a, b) => a.position - b.position);
            const sittingAncestry = sortedLosers.map((lm) => winnersAncestry(matches, lm.id, 1));
            const used = new Set();
            const sortedWinners = [...winnersMatches].sort((a, b) => a.position - b.position);
            for (const wm of sortedWinners) {
                const own = new Set([wm.id]);
                for (const s of [1, 2])
                    for (const id of winnersAncestry(matches, wm.id, s))
                        own.add(id);
                let chosen = sortedLosers.findIndex((_, p) => !used.has(p) && ![...sittingAncestry[p]].some((id) => own.has(id)));
                if (chosen === -1)
                    chosen = sortedLosers.findIndex((_, p) => !used.has(p));
                used.add(chosen);
                wm.loserNextMatchId = sortedLosers[chosen].id;
                wm.loserNextMatchSlot = 2;
            }
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
//# sourceMappingURL=double-elimination.js.map