import { generateMatchId, computeRoundCounts, computeRoundByes, compressedSeedOrder, computeLosersBracketShape, } from './utils.js';
/**
 * Generate a double elimination bracket with FLOW BYES.
 *
 * Winners bracket (WB) uses the same flow-byes shape as single-elimination:
 *   - `computeRoundCounts(N)` matches per round, `computeRoundByes(N)` byes per
 *     round, byes implemented as routing (no bye-match records).
 *   - Total WB matches = N - 1.
 *
 * Losers bracket (LB) uses the shape from `computeLosersBracketShape(N)`:
 *   - 2 * (wbRounds - 1) rounds, alternating drop-in and consolidate.
 *   - Drop-in rounds: pair prev LB advances ("carryover") with WB losers
 *     ("drop-in"). Slot 1 = carryover, slot 2 = drop-in.
 *   - Consolidate rounds: pair prev LB advances with each other.
 *   - Byes again implemented purely as routing — no bye-match records.
 *   - Total LB matches = N - 2.
 *
 * Grand finals: GF1 (WB winner vs LB winner) + GF2 (bracket reset). Both
 * records are always created when `grandFinalReset` is true (default).
 *
 * Total record count = (N - 1) + (N - 2) + (1 or 2) = 2N - 3 or 2N - 2.
 */
export function generateDoubleElimination(options) {
    const { tournamentId, participants, grandFinalReset = true } = options;
    const participantCount = participants.length;
    if (participantCount < 2) {
        throw new Error('Need at least 2 participants for a bracket');
    }
    const wbCounts = computeRoundCounts(participantCount);
    const wbByes = computeRoundByes(participantCount);
    const wbRounds = wbCounts.length;
    const lbShape = computeLosersBracketShape(participantCount);
    const lbRounds = lbShape.length;
    const participantBySeed = new Map();
    for (const p of participants) {
        participantBySeed.set(p.seed, p);
    }
    const matches = [];
    // === Create WB match records ===
    for (let round = 1; round <= wbRounds; round++) {
        const matchesInRound = wbCounts[round - 1];
        for (let position = 1; position <= matchesInRound; position++) {
            matches.push({
                id: generateMatchId(tournamentId, 'winners', round, position),
                round,
                position,
                bracketType: 'winners',
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
            });
        }
    }
    // === Create LB match records ===
    for (const info of lbShape) {
        for (let position = 1; position <= info.matches; position++) {
            matches.push({
                id: generateMatchId(tournamentId, 'losers', info.round, position),
                round: info.round,
                position,
                bracketType: 'losers',
                participant1: null,
                participant2: null,
                participant1Seed: null,
                participant2Seed: null,
                winner: null,
                status: 'pending',
                nextMatchId: null,
                nextMatchSlot: null,
                // LB losers are always eliminated.
                loserNextMatchId: null,
                loserNextMatchSlot: null,
            });
        }
    }
    // === Create GF match records ===
    const gf1Id = generateMatchId(tournamentId, 'grand_final', 1, 1);
    const gf2Id = generateMatchId(tournamentId, 'grand_final', 2, 1);
    matches.push({
        id: gf1Id,
        round: 1,
        position: 1,
        bracketType: 'grand_final',
        participant1: null,
        participant2: null,
        participant1Seed: null,
        participant2Seed: null,
        winner: null,
        status: 'pending',
        nextMatchId: grandFinalReset ? gf2Id : null,
        nextMatchSlot: null, // Special-handled in reportDoubleElimMatchResult.
        loserNextMatchId: grandFinalReset ? gf2Id : null,
        loserNextMatchSlot: null,
    });
    if (grandFinalReset) {
        matches.push({
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
        });
    }
    const wbByeAtTop = (round) => round % 2 === 1;
    const buildWBInputSlots = (round) => {
        const matchesInRound = wbCounts[round - 1];
        const byeInRound = wbByes[round - 1];
        const realSlots = [];
        for (let p = 1; p <= matchesInRound; p++) {
            realSlots.push({ kind: 'matchSlot', round, position: p, slot: 1 });
            realSlots.push({ kind: 'matchSlot', round, position: p, slot: 2 });
        }
        if (byeInRound === 1) {
            return wbByeAtTop(round)
                ? [{ kind: 'bye', round }, ...realSlots]
                : [...realSlots, { kind: 'bye', round }];
        }
        return realSlots;
    };
    const buildWBOutputs = (round) => {
        const matchesInRound = wbCounts[round - 1];
        const byeInRound = wbByes[round - 1];
        const matchOutputs = [];
        for (let p = 1; p <= matchesInRound; p++) {
            matchOutputs.push({ kind: 'matchWinner', round, position: p });
        }
        if (byeInRound === 1) {
            return wbByeAtTop(round)
                ? [{ kind: 'bye', round }, ...matchOutputs]
                : [...matchOutputs, { kind: 'bye', round }];
        }
        return matchOutputs;
    };
    const wbOutputKey = (o) => o.kind === 'matchWinner' ? `wm_${o.round}_${o.position}` : `wb_${o.round}`;
    const wbOutputToSlot = new Map();
    for (let r = 1; r < wbRounds; r++) {
        const outs = buildWBOutputs(r);
        const slots = buildWBInputSlots(r + 1);
        if (outs.length !== slots.length) {
            throw new Error(`WB linking mismatch: round ${r} outputs=${outs.length}, round ${r + 1} slots=${slots.length}`);
        }
        for (let i = 0; i < outs.length; i++) {
            wbOutputToSlot.set(wbOutputKey(outs[i]), slots[i]);
        }
    }
    const resolveWBDest = (startOutput) => {
        let cur = startOutput;
        while (true) {
            const slot = wbOutputToSlot.get(wbOutputKey(cur));
            if (!slot)
                return null;
            if (slot.kind === 'matchSlot') {
                return {
                    matchId: generateMatchId(tournamentId, 'winners', slot.round, slot.position),
                    slot: slot.slot,
                };
            }
            cur = { kind: 'bye', round: slot.round };
        }
    };
    // Apply WB winner routing.
    for (const m of matches) {
        if (m.bracketType !== 'winners')
            continue;
        if (m.round < wbRounds) {
            const dest = resolveWBDest({ kind: 'matchWinner', round: m.round, position: m.position });
            if (dest) {
                m.nextMatchId = dest.matchId;
                m.nextMatchSlot = dest.slot;
            }
        }
    }
    const lbByeAtTop = (round) => round % 2 === 1;
    const lbInfoByRound = new Map();
    for (const info of lbShape) {
        lbInfoByRound.set(info.round, info);
    }
    const buildLBCarryoverSlots = (round) => {
        const info = lbInfoByRound.get(round);
        if (!info)
            return [];
        const carryMatchCount = Math.min(info.carryover, info.matches);
        const realSlots = [];
        if (info.isDropIn) {
            // Drop-in: only slot1 of each match comes from carryover.
            // (But L1 has carryover=0, so this is empty for L1.)
            for (let p = 1; p <= carryMatchCount; p++) {
                realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 1 });
            }
        }
        else {
            // Consolidate: both slots of each match come from carryover.
            for (let p = 1; p <= info.matches; p++) {
                realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 1 });
                realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 2 });
            }
        }
        const carryBye = info.carryover > realSlots.length ? 1 : 0;
        if (carryBye === 1) {
            const byeSlot = { kind: 'lbBye', round, side: 'carry' };
            return lbByeAtTop(round) ? [byeSlot, ...realSlots] : [...realSlots, byeSlot];
        }
        return realSlots;
    };
    const buildLBDropInSlots = (round) => {
        const info = lbInfoByRound.get(round);
        if (!info || !info.isDropIn)
            return [];
        if (info.round === 1) {
            // L1 special: all WB R1 losers fill both slot1 AND slot2 of each match
            // (no carryover). Bye, if any, is on this dropIn side.
            const realSlots = [];
            for (let p = 1; p <= info.matches; p++) {
                realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 1 });
                realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 2 });
            }
            const dropBye = info.dropIn > realSlots.length ? 1 : 0;
            if (dropBye === 1) {
                const byeSlot = { kind: 'lbBye', round, side: 'drop' };
                return lbByeAtTop(round) ? [byeSlot, ...realSlots] : [...realSlots, byeSlot];
            }
            return realSlots;
        }
        // General drop-in: dropIn side = slot 2 of each match.
        const dropMatchCount = Math.min(info.dropIn, info.matches);
        const realSlots = [];
        for (let p = 1; p <= dropMatchCount; p++) {
            realSlots.push({ kind: 'lbMatchSlot', round, position: p, slot: 2 });
        }
        const dropBye = info.dropIn > realSlots.length ? 1 : 0;
        if (dropBye === 1) {
            const byeSlot = { kind: 'lbBye', round, side: 'drop' };
            return lbByeAtTop(round) ? [byeSlot, ...realSlots] : [...realSlots, byeSlot];
        }
        return realSlots;
    };
    const buildLBOutputs = (round) => {
        const info = lbInfoByRound.get(round);
        if (!info)
            return [];
        const matchOutputs = [];
        for (let p = 1; p <= info.matches; p++) {
            matchOutputs.push({ kind: 'lbMatchWinner', round, position: p });
        }
        if (info.byes === 1) {
            const byeOut = { kind: 'lbBye', round };
            return lbByeAtTop(round) ? [byeOut, ...matchOutputs] : [...matchOutputs, byeOut];
        }
        return matchOutputs;
    };
    const lbOutputKey = (o) => o.kind === 'lbMatchWinner' ? `lm_${o.round}_${o.position}` : `lb_${o.round}`;
    // Map LB round R outputs → round R+1 carryover slots (top-to-bottom).
    const lbOutputToCarrySlot = new Map();
    for (let r = 1; r < lbRounds; r++) {
        const outs = buildLBOutputs(r);
        const slots = buildLBCarryoverSlots(r + 1);
        if (outs.length !== slots.length) {
            throw new Error(`LB carryover linking mismatch: round ${r} outputs=${outs.length}, round ${r + 1} carryover slots=${slots.length}`);
        }
        for (let i = 0; i < outs.length; i++) {
            lbOutputToCarrySlot.set(lbOutputKey(outs[i]), slots[i]);
        }
    }
    // Resolve LB output → final destination, following carry-side bye chains
    // through subsequent rounds.
    const resolveLBDest = (startOutput) => {
        let cur = startOutput;
        while (true) {
            const slot = lbOutputToCarrySlot.get(lbOutputKey(cur));
            if (!slot)
                return null; // No further LB round — this is the LB final's output.
            if (slot.kind === 'lbMatchSlot') {
                return {
                    matchId: generateMatchId(tournamentId, 'losers', slot.round, slot.position),
                    slot: slot.slot,
                };
            }
            // Carry-bye slot: continue with next round's bye output.
            cur = { kind: 'lbBye', round: slot.round };
        }
    };
    // Apply LB winner routing.
    for (const m of matches) {
        if (m.bracketType !== 'losers')
            continue;
        const dest = resolveLBDest({ kind: 'lbMatchWinner', round: m.round, position: m.position });
        if (dest) {
            m.nextMatchId = dest.matchId;
            m.nextMatchSlot = dest.slot;
        }
        // If null, this is the LB final → routes to GF (handled below).
    }
    // === Route WB losers to LB drop-in slots ===
    //
    // For each WB round R, build a top-to-bottom list of WB losers
    // (= WB match losers in match position order; we treat WB rounds with byes
    // the same — bye outputs are NOT losers, only match losers).
    //
    // Then find the LB drop-in round fed by WB R, take its dropIn slot list,
    // and pair them up in order. The drop-in slot list always has dropIn
    // entries (one per WB loser), so they pair 1-to-1.
    // Build a reverse map: WB round → LB drop-in round.
    const wbRoundToLBDropIn = new Map();
    for (const info of lbShape) {
        if (info.isDropIn && info.wbLoserFeedRound !== null) {
            wbRoundToLBDropIn.set(info.wbLoserFeedRound, info.round);
        }
    }
    // Resolve a dropIn slot, which (if it's a bye slot) chains through subsequent
    // carry-bye routing in later LB rounds.
    const resolveLBDropInSlot = (slot) => {
        if (slot.kind === 'lbMatchSlot') {
            return {
                matchId: generateMatchId(tournamentId, 'losers', slot.round, slot.position),
                slot: slot.slot,
            };
        }
        // Drop-in bye: the WB loser byes through this LB round and shows up at the
        // bye output, which then routes into the next LB round via the carry chain.
        return resolveLBDest({ kind: 'lbBye', round: slot.round });
    };
    for (let wbR = 1; wbR <= wbRounds; wbR++) {
        const lbR = wbRoundToLBDropIn.get(wbR);
        const wbMatchesInR = wbCounts[wbR - 1];
        if (lbR === undefined) {
            // WB final or WB round with no LB feed → losers go to GF (handled later
            // for the final).
            continue;
        }
        const dropInSlots = buildLBDropInSlots(lbR);
        if (dropInSlots.length !== wbMatchesInR) {
            throw new Error(`LB drop-in linking mismatch: WB R${wbR} losers=${wbMatchesInR}, LB R${lbR} dropIn slots=${dropInSlots.length}`);
        }
        for (let i = 0; i < wbMatchesInR; i++) {
            const wbMatchId = generateMatchId(tournamentId, 'winners', wbR, i + 1);
            const wbMatch = matches.find(m => m.id === wbMatchId);
            if (!wbMatch)
                continue;
            const dest = resolveLBDropInSlot(dropInSlots[i]);
            if (dest) {
                wbMatch.loserNextMatchId = dest.matchId;
                wbMatch.loserNextMatchSlot = dest.slot;
            }
        }
    }
    // === Link WB final → GF1 slot 1, LB final → GF1 slot 2 ===
    //
    // WB final loser routing:
    //   - N >= 3: WB final loser drops into the LB final's drop-in slot
    //     (already wired by the WB-loser → LB drop-in loop above).
    //   - N == 2: no LB rounds, WB final loser goes directly to GF1 slot 2.
    const wbFinalId = generateMatchId(tournamentId, 'winners', wbRounds, 1);
    const wbFinal = matches.find(m => m.id === wbFinalId);
    if (wbFinal) {
        wbFinal.nextMatchId = gf1Id;
        wbFinal.nextMatchSlot = 1;
        if (lbRounds === 0) {
            wbFinal.loserNextMatchId = gf1Id;
            wbFinal.loserNextMatchSlot = 2;
        }
    }
    if (lbRounds > 0) {
        const lbFinalId = generateMatchId(tournamentId, 'losers', lbRounds, 1);
        const lbFinal = matches.find(m => m.id === lbFinalId);
        if (lbFinal) {
            lbFinal.nextMatchId = gf1Id;
            lbFinal.nextMatchSlot = 2;
        }
    }
    // === Assign seeds to WB R1 entry slots ===
    const r1Slots = buildWBInputSlots(1);
    if (r1Slots.length !== participantCount) {
        throw new Error(`Internal: WB R1 input slot count ${r1Slots.length} !== participantCount ${participantCount}`);
    }
    const compressedOrder = compressedSeedOrder(participantCount);
    if (compressedOrder.length !== participantCount) {
        throw new Error('Internal: compressed seed order length mismatch');
    }
    for (let i = 0; i < r1Slots.length; i++) {
        const slot = r1Slots[i];
        const seed = compressedOrder[i];
        const participant = participantBySeed.get(seed);
        if (!participant) {
            throw new Error(`Missing participant for seed ${seed}`);
        }
        if (slot.kind === 'matchSlot') {
            const targetMatch = matches.find(m => m.bracketType === 'winners' && m.round === slot.round && m.position === slot.position);
            if (!targetMatch)
                continue;
            if (slot.slot === 1) {
                targetMatch.participant1 = participant.id;
                targetMatch.participant1Seed = seed;
            }
            else {
                targetMatch.participant2 = participant.id;
                targetMatch.participant2Seed = seed;
            }
        }
        else {
            // R1 WB bye-slot: advance the seed directly through the bye chain.
            const dest = resolveWBDest({ kind: 'bye', round: 1 });
            if (dest) {
                const targetMatch = matches.find(m => m.id === dest.matchId);
                if (targetMatch) {
                    if (dest.slot === 1) {
                        targetMatch.participant1 = participant.id;
                        targetMatch.participant1Seed = seed;
                    }
                    else {
                        targetMatch.participant2 = participant.id;
                        targetMatch.participant2Seed = seed;
                    }
                }
            }
        }
    }
    updateMatchStatuses(matches);
    const totalRounds = wbRounds + lbRounds + (grandFinalReset ? 2 : 1);
    return {
        tournamentId,
        format: 'double_elim',
        matches,
        totalRounds,
        participantCount,
    };
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
/**
 * Report a match result in double elimination.
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
    // Advance winner.
    if (match.nextMatchId && winnerSeed !== null) {
        if (match.bracketType === 'grand_final' && match.round === 1) {
            // GF1 special handling: bracket reset logic.
            const gf2 = matches.find(m => m.bracketType === 'grand_final' && m.round === 2);
            if (gf2) {
                if (match.participant1 === winnerId) {
                    // WB-bracket player won GF1 → tournament over, GF2 not needed.
                    gf2.status = 'bye';
                }
                else {
                    // LB-bracket player won GF1 → reset needed.
                    gf2.participant1 = match.participant1;
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
    // Send loser to losers bracket (if applicable). Skip for grand finals — they
    // have special handling above.
    if (match.loserNextMatchId &&
        loserId &&
        loserSeed !== null &&
        match.bracketType !== 'grand_final') {
        advanceToMatch(matches, match.loserNextMatchId, match.loserNextMatchSlot, loserId, loserSeed);
    }
    updateMatchStatuses(matches);
    return {
        ...bracket,
        matches,
    };
}
//# sourceMappingURL=double-elimination.js.map