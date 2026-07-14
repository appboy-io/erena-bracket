import { nextPowerOf2, calculateRounds, generateMatchId, slotsFromSeeding, } from './utils.js';
/**
 * Generate a single elimination bracket
 */
export function generateSingleElimination(options) {
    const { tournamentId, participants } = options;
    if (participants.length < 2) {
        throw new Error('Need at least 2 participants for a bracket');
    }
    const bracketSize = nextPowerOf2(participants.length);
    const slots = slotsFromSeeding(participants, bracketSize);
    return buildSingleElimination(tournamentId, slots);
}
/** Build a single-elim bracket from an explicit slot array (length must be a
 *  power of two). slots[i] is the participant in round-1 slot i, or null (bye). */
export function buildSingleElimination(tournamentId, slots) {
    const bracketSize = slots.length;
    const totalRounds = calculateRounds(bracketSize);
    const realCount = slots.filter((s) => s !== null).length;
    const matches = [];
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
            matches.push({
                id: matchId, round, position, bracketType: 'winners',
                participant1: null, participant2: null, participant1Seed: null, participant2Seed: null,
                winner: null, status: 'pending', nextMatchId, nextMatchSlot,
                loserNextMatchId: null, loserNextMatchSlot: null,
            });
        }
    }
    const firstRound = matches.filter((m) => m.round === 1);
    for (let i = 0; i < firstRound.length; i++) {
        const match = firstRound[i];
        const p1 = slots[i * 2] ?? undefined;
        const p2 = slots[i * 2 + 1] ?? undefined;
        if (p1 && !p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.winner = p1.id;
            match.status = 'bye';
            if (match.nextMatchId)
                advanceWinner(matches, match.nextMatchId, match.nextMatchSlot, p1.id, p1.seed);
        }
        else if (!p1 && p2) {
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.winner = p2.id;
            match.status = 'bye';
            if (match.nextMatchId)
                advanceWinner(matches, match.nextMatchId, match.nextMatchSlot, p2.id, p2.seed);
        }
        else if (p1 && p2) {
            match.participant1 = p1.id;
            match.participant1Seed = p1.seed;
            match.participant2 = p2.id;
            match.participant2Seed = p2.seed;
            match.status = 'ready';
        } // both null: leave pending (dead slot)
    }
    updateMatchStatuses(matches);
    return { tournamentId, format: 'single_elim', matches, totalRounds, participantCount: realCount };
}
/**
 * Advance a winner to their next match
 */
function advanceWinner(matches, nextMatchId, slot, participantId, seed) {
    const nextMatch = matches.find(m => m.id === nextMatchId);
    if (!nextMatch)
        return;
    if (slot === 1) {
        nextMatch.participant1 = participantId;
        nextMatch.participant1Seed = seed;
    }
    else {
        nextMatch.participant2 = participantId;
        nextMatch.participant2Seed = seed;
    }
}
/**
 * Update match statuses based on participant availability
 */
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
 * Report a match result and advance the winner
 */
export function reportMatchResult(bracket, matchId, winnerId) {
    const matches = [...bracket.matches];
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
        throw new Error(`Match ${matchId} not found`);
    }
    const match = { ...matches[matchIndex] };
    matches[matchIndex] = match;
    if (match.participant1 !== winnerId && match.participant2 !== winnerId) {
        throw new Error(`Winner ${winnerId} is not a participant in match ${matchId}`);
    }
    match.winner = winnerId;
    match.status = 'completed';
    const winnerSeed = match.participant1 === winnerId
        ? match.participant1Seed
        : match.participant2Seed;
    // Advance winner to next match
    if (match.nextMatchId && winnerSeed !== null) {
        advanceWinner(matches, match.nextMatchId, match.nextMatchSlot, winnerId, winnerSeed);
        updateMatchStatuses(matches);
    }
    return {
        ...bracket,
        matches,
    };
}
//# sourceMappingURL=single-elimination.js.map