import { describe, it, expect } from 'vitest';
import { generateDoubleElimination, reportDoubleElimMatchResult } from './double-elimination.js';
import type { Bracket, Match, Participant } from './types.js';
import { computeLosersBracketShape, computeRoundCounts } from './utils.js';

function createParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player_${i + 1}`,
    seed: i + 1,
    name: `Player ${i + 1}`,
  }));
}

function wb(b: Bracket): Match[] {
  return b.matches.filter(m => m.bracketType === 'winners');
}

function lb(b: Bracket): Match[] {
  return b.matches.filter(m => m.bracketType === 'losers');
}

function gf(b: Bracket): Match[] {
  return b.matches.filter(m => m.bracketType === 'grand_final');
}

/** Validate that the DE bracket has a well-formed advancement graph. */
function assertValidDEStructure(b: Bracket, n: number, grandFinalReset = true): void {
  const wbCounts = computeRoundCounts(n);
  const wbRounds = wbCounts.length;
  const lbShape = computeLosersBracketShape(n);
  const lbRounds = lbShape.length;

  const wbExpected = n - 1;
  const lbExpected = Math.max(0, n - 2);
  const gfExpected = grandFinalReset ? 2 : 1;
  const totalExpected = wbExpected + lbExpected + gfExpected;

  expect(wb(b).length).toBe(wbExpected);
  expect(lb(b).length).toBe(lbExpected);
  expect(gf(b).length).toBe(gfExpected);
  expect(b.matches.length).toBe(totalExpected);

  // All nextMatchId / loserNextMatchId references resolve to existing matches.
  const matchById = new Map(b.matches.map(m => [m.id, m]));
  for (const m of b.matches) {
    if (m.nextMatchId !== null) {
      expect(matchById.has(m.nextMatchId)).toBe(true);
    }
    if (m.loserNextMatchId !== null) {
      expect(matchById.has(m.loserNextMatchId)).toBe(true);
    }
  }

  // Every LB match has loserNextMatchId === null (LB losers are eliminated).
  for (const m of lb(b)) {
    expect(m.loserNextMatchId).toBeNull();
    expect(m.loserNextMatchSlot).toBeNull();
  }

  // Every WB match that's not the final has a loserNextMatchId pointing to an LB match.
  // WB final's loserNextMatchId points to the LB final (for N >= 3) or to GF1
  // slot 2 (for N == 2, where no LB exists).
  for (const m of wb(b)) {
    if (m.round < wbRounds) {
      expect(m.loserNextMatchId).not.toBeNull();
      const target = matchById.get(m.loserNextMatchId!);
      expect(target).toBeDefined();
      expect(target!.bracketType).toBe('losers');
    } else {
      // WB final.
      expect(m.loserNextMatchId).not.toBeNull();
      const target = matchById.get(m.loserNextMatchId!);
      expect(target).toBeDefined();
      if (lbRounds === 0) {
        expect(target!.bracketType).toBe('grand_final');
        expect(target!.round).toBe(1);
        expect(m.loserNextMatchSlot).toBe(2);
      } else {
        // WB final loser drops into the LB final.
        expect(target!.bracketType).toBe('losers');
        expect(target!.round).toBe(lbRounds);
        expect(m.loserNextMatchSlot).toBe(2);
      }
    }
  }

  // Every WB match (except WB final) has a nextMatchId pointing to another WB match.
  // WB final's nextMatchId points to GF1.
  for (const m of wb(b)) {
    if (m.round < wbRounds) {
      expect(m.nextMatchId).not.toBeNull();
      const target = matchById.get(m.nextMatchId!);
      expect(target).toBeDefined();
      expect(target!.bracketType).toBe('winners');
    } else {
      expect(m.nextMatchId).toBe(gf(b).find(g => g.round === 1)!.id);
      expect(m.nextMatchSlot).toBe(1);
    }
  }

  // LB final's nextMatchId → GF1 slot 2. Other LB matches → another LB match.
  for (const m of lb(b)) {
    if (m.round === lbRounds) {
      expect(m.nextMatchId).toBe(gf(b).find(g => g.round === 1)!.id);
      expect(m.nextMatchSlot).toBe(2);
    } else {
      // Non-final LB match must have nextMatchId pointing to a later LB match.
      expect(m.nextMatchId).not.toBeNull();
      const target = matchById.get(m.nextMatchId!);
      expect(target).toBeDefined();
      expect(target!.bracketType).toBe('losers');
      expect(target!.round).toBeGreaterThan(m.round);
    }
  }

  // No cycles in the advancement graph: walking from any match should
  // eventually terminate.
  for (const start of b.matches) {
    let cur: Match | undefined = start;
    let steps = 0;
    while (cur && cur.nextMatchId) {
      cur = matchById.get(cur.nextMatchId);
      steps++;
      if (steps > b.matches.length * 2) {
        throw new Error(`Cycle detected starting from match ${start.id}`);
      }
    }
    expect(cur).toBeDefined();
  }

  // No participant appears in two WB R1 slots.
  const r1Slots: string[] = [];
  for (const m of wb(b).filter(m => m.round === 1)) {
    if (m.participant1) r1Slots.push(m.participant1);
    if (m.participant2) r1Slots.push(m.participant2);
  }
  const r1Set = new Set(r1Slots);
  expect(r1Set.size).toBe(r1Slots.length);
}

describe('generateDoubleElimination — error handling', () => {
  it('throws error for less than 2 participants', () => {
    expect(() =>
      generateDoubleElimination({
        tournamentId: 'test',
        participants: createParticipants(1),
      })
    ).toThrow('Need at least 2 participants');
  });
});

describe('generateDoubleElimination — N=2 (trivial)', () => {
  it('produces 1 WB match, 0 LB matches, 2 GF matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(2),
    });
    expect(wb(b).length).toBe(1);
    expect(lb(b).length).toBe(0);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(3);

    // WB final's loser goes directly to GF1 slot 2.
    const wbFinal = wb(b)[0]!;
    expect(wbFinal.loserNextMatchId).toBe(gf(b).find(g => g.round === 1)!.id);
    expect(wbFinal.loserNextMatchSlot).toBe(2);

    assertValidDEStructure(b, 2);
  });
});

describe('generateDoubleElimination — N=3', () => {
  it('produces 2 WB matches, 1 LB match, 2 GF matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(3),
    });
    // WB: [1, 1] = 2 matches. LB: N-2 = 1 match. GF: 2.
    expect(wb(b).length).toBe(2);
    expect(lb(b).length).toBe(1);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(5);

    assertValidDEStructure(b, 3);
  });
});

describe('generateDoubleElimination — N=4 (power of 2)', () => {
  it('produces 3 WB matches, 2 LB matches, 2 GF matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    expect(wb(b).length).toBe(3);
    expect(lb(b).length).toBe(2);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(7);

    // Standard pairings in WB R1.
    const wbR1 = wb(b).filter(m => m.round === 1).sort((a, b) => a.position - b.position);
    expect(wbR1[0]!.participant1Seed).toBe(1);
    expect(wbR1[0]!.participant2Seed).toBe(4);
    expect(wbR1[1]!.participant1Seed).toBe(2);
    expect(wbR1[1]!.participant2Seed).toBe(3);

    assertValidDEStructure(b, 4);
  });

  it('links WB R1 losers to LB R1', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const wbR1 = wb(b).filter(m => m.round === 1);
    for (const m of wbR1) {
      expect(m.loserNextMatchId).not.toBeNull();
      const target = b.matches.find(x => x.id === m.loserNextMatchId);
      expect(target?.bracketType).toBe('losers');
      expect(target?.round).toBe(1);
    }
  });
});

describe('generateDoubleElimination — N=5', () => {
  it('produces 4 WB matches, 3 LB matches, 2 GF matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(5),
    });
    expect(wb(b).length).toBe(4);
    expect(lb(b).length).toBe(3);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(9);

    // LB shape: [1, 1, 0, 1] — L3 has 0 matches (consolidate with 1 alive → bye).
    expect(lb(b).filter(m => m.round === 1).length).toBe(1);
    expect(lb(b).filter(m => m.round === 2).length).toBe(1);
    expect(lb(b).filter(m => m.round === 3).length).toBe(0);
    expect(lb(b).filter(m => m.round === 4).length).toBe(1);

    assertValidDEStructure(b, 5);
  });
});

describe('generateDoubleElimination — N=6', () => {
  it('produces 5 WB, 4 LB, 2 GF matches with byes in L1 and L2', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(6),
    });
    expect(wb(b).length).toBe(5);
    expect(lb(b).length).toBe(4);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(11);

    // LB shape: [1, 1, 1, 1].
    for (let r = 1; r <= 4; r++) {
      expect(lb(b).filter(m => m.round === r).length).toBe(1);
    }

    assertValidDEStructure(b, 6);
  });
});

describe('generateDoubleElimination — N=8 (power of 2)', () => {
  it('produces 7 WB, 6 LB, 2 GF matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(8),
    });
    expect(wb(b).length).toBe(7);
    expect(lb(b).length).toBe(6);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(15);

    // Standard pairings in WB R1: 1v8, 4v5, 2v7, 3v6.
    const wbR1 = wb(b).filter(m => m.round === 1).sort((a, b) => a.position - b.position);
    expect(wbR1[0]!.participant1Seed).toBe(1);
    expect(wbR1[0]!.participant2Seed).toBe(8);
    expect(wbR1[1]!.participant1Seed).toBe(4);
    expect(wbR1[1]!.participant2Seed).toBe(5);
    expect(wbR1[2]!.participant1Seed).toBe(2);
    expect(wbR1[2]!.participant2Seed).toBe(7);
    expect(wbR1[3]!.participant1Seed).toBe(3);
    expect(wbR1[3]!.participant2Seed).toBe(6);

    assertValidDEStructure(b, 8);
  });
});

describe('generateDoubleElimination — N=13 (canonical flow-byes case)', () => {
  it('produces 12 WB, 11 LB, 2 GF matches = 25 total', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    expect(wb(b).length).toBe(12);
    expect(lb(b).length).toBe(11);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(25);

    // WB shape: [6, 3, 2, 1].
    expect(wb(b).filter(m => m.round === 1).length).toBe(6);
    expect(wb(b).filter(m => m.round === 2).length).toBe(3);
    expect(wb(b).filter(m => m.round === 3).length).toBe(2);
    expect(wb(b).filter(m => m.round === 4).length).toBe(1);

    // LB shape: [3, 3, 1, 2, 1, 1].
    expect(lb(b).filter(m => m.round === 1).length).toBe(3);
    expect(lb(b).filter(m => m.round === 2).length).toBe(3);
    expect(lb(b).filter(m => m.round === 3).length).toBe(1);
    expect(lb(b).filter(m => m.round === 4).length).toBe(2);
    expect(lb(b).filter(m => m.round === 5).length).toBe(1);
    expect(lb(b).filter(m => m.round === 6).length).toBe(1);

    assertValidDEStructure(b, 13);
  });

  it('routes WB R1 losers into L1 matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const wbR1 = wb(b).filter(m => m.round === 1).sort((a, b) => a.position - b.position);
    for (const m of wbR1) {
      expect(m.loserNextMatchId).not.toBeNull();
      const target = b.matches.find(x => x.id === m.loserNextMatchId);
      expect(target?.bracketType).toBe('losers');
      expect(target?.round).toBe(1);
    }
  });

  it('routes WB R2 losers into L2 slot 2', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const wbR2 = wb(b).filter(m => m.round === 2).sort((a, b) => a.position - b.position);
    for (const m of wbR2) {
      expect(m.loserNextMatchId).not.toBeNull();
      const target = b.matches.find(x => x.id === m.loserNextMatchId);
      expect(target?.bracketType).toBe('losers');
      expect(target?.round).toBe(2);
      expect(m.loserNextMatchSlot).toBe(2);
    }
  });

  it('routes WB R3 losers into L4', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const wbR3 = wb(b).filter(m => m.round === 3);
    for (const m of wbR3) {
      const target = b.matches.find(x => x.id === m.loserNextMatchId);
      expect(target?.bracketType).toBe('losers');
      expect(target?.round).toBe(4);
    }
  });

  it('routes WB R4 loser into L6 (the LB final, as slot 2)', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const wbR4 = wb(b).filter(m => m.round === 4);
    expect(wbR4.length).toBe(1);
    // WB R4 IS the WB final. Its loser drops into the LB final (L6) as slot 2.
    const target = b.matches.find(x => x.id === wbR4[0]!.loserNextMatchId);
    expect(target?.bracketType).toBe('losers');
    expect(target?.round).toBe(6);
    expect(wbR4[0]!.loserNextMatchSlot).toBe(2);
  });

  it('L3 (consolidate with bye) routes correctly via skip-bye to L4', () => {
    // L3 has 1 match, 1 bye → 2 advances. Both should reach L4 slot 1
    // (one as the L3 match winner, one as the bye-getter from L2).
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const l3 = lb(b).filter(m => m.round === 3);
    expect(l3.length).toBe(1);
    // L3 match winner should advance to one of the L4 slot 1s.
    const target = b.matches.find(x => x.id === l3[0]!.nextMatchId);
    expect(target?.bracketType).toBe('losers');
    expect(target?.round).toBe(4);
    expect(l3[0]!.nextMatchSlot).toBe(1);

    // One L2 match's winner should bypass L3 and land directly in L4 slot 1
    // (the OTHER L4 match's slot 1).
    const l2 = lb(b).filter(m => m.round === 2).sort((a, b) => a.position - b.position);
    const l2WinnersDestinations = l2.map(m => ({
      match: m,
      targetMatch: b.matches.find(x => x.id === m.nextMatchId),
      slot: m.nextMatchSlot,
    }));
    const skippingToL4 = l2WinnersDestinations.filter(
      d => d.targetMatch?.bracketType === 'losers' && d.targetMatch.round === 4
    );
    // Exactly one L2 match winner should skip L3 (the bye-output of L3).
    expect(skippingToL4.length).toBe(1);
    expect(skippingToL4[0]!.slot).toBe(1);
    // And another L2 match winner should go INTO L3.
    const intoL3 = l2WinnersDestinations.filter(
      d => d.targetMatch?.bracketType === 'losers' && d.targetMatch.round === 3
    );
    expect(intoL3.length).toBe(2); // L3 has 1 match with 2 slots filled.
  });

  it('L4 slot 2s receive WB R3 losers', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });
    const wbR3 = wb(b).filter(m => m.round === 3).sort((a, b) => a.position - b.position);
    const l4Slot2Targets = wbR3.map(m => ({
      lbMatchId: m.loserNextMatchId,
      slot: m.loserNextMatchSlot,
    }));
    for (const t of l4Slot2Targets) {
      expect(t.slot).toBe(2);
    }
    // The two WB R3 matches should target the two different L4 matches.
    const distinctTargets = new Set(l4Slot2Targets.map(t => t.lbMatchId));
    expect(distinctTargets.size).toBe(2);
  });
});

describe('generateDoubleElimination — N=16 (power of 2)', () => {
  it('produces 15 WB, 14 LB, 2 GF = 31 total matches', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(16),
    });
    expect(wb(b).length).toBe(15);
    expect(lb(b).length).toBe(14);
    expect(gf(b).length).toBe(2);
    expect(b.matches.length).toBe(31);

    // Standard pairing 1v16, 8v9, 5v12, 4v13, 2v15, 7v10, 3v14, 6v11 etc.
    const wbR1 = wb(b).filter(m => m.round === 1).sort((a, b) => a.position - b.position);
    expect(wbR1[0]!.participant1Seed).toBe(1);
    expect(wbR1[0]!.participant2Seed).toBe(16);

    assertValidDEStructure(b, 16);
  });
});

describe('generateDoubleElimination — total match formula for many N', () => {
  it('matches expected formula for various N', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 16, 17, 23, 32, 33, 64]) {
      const b = generateDoubleElimination({
        tournamentId: 't',
        participants: createParticipants(n),
      });
      const wbExpected = n - 1;
      const lbExpected = Math.max(0, n - 2);
      const total = wbExpected + lbExpected + 2; // +2 for GF1+GF2.
      expect(b.matches.length).toBe(total);
      assertValidDEStructure(b, n);
    }
  });
});

describe('generateDoubleElimination — can disable grand finals reset', () => {
  it('produces only 1 GF match when reset is disabled', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
      grandFinalReset: false,
    });
    expect(gf(b).length).toBe(1);
    const gf1 = gf(b)[0]!;
    expect(gf1.nextMatchId).toBeNull();
    expect(gf1.loserNextMatchId).toBeNull();
  });
});

describe('generateDoubleElimination — WB final routing', () => {
  it('routes WB final winner to GF1 slot 1', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(8),
    });
    const wbFinal = wb(b).find(m => m.round === 3)!;
    const gf1 = gf(b).find(g => g.round === 1)!;
    expect(wbFinal.nextMatchId).toBe(gf1.id);
    expect(wbFinal.nextMatchSlot).toBe(1);
  });

  it('routes WB final loser to LB final slot 2 (for N=8, N>=3)', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(8),
    });
    const wbFinal = wb(b).find(m => m.round === 3)!;
    const lbShape = computeLosersBracketShape(8);
    const lbFinal = lb(b).find(m => m.round === lbShape.length)!;
    expect(wbFinal.loserNextMatchId).toBe(lbFinal.id);
    expect(wbFinal.loserNextMatchSlot).toBe(2);
  });

  it('routes WB final loser to GF1 slot 2 when N=2 (no LB)', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(2),
    });
    const wbFinal = wb(b)[0]!;
    const gf1 = gf(b).find(g => g.round === 1)!;
    expect(wbFinal.loserNextMatchId).toBe(gf1.id);
    expect(wbFinal.loserNextMatchSlot).toBe(2);
  });

  it('routes LB final winner to GF1 slot 2', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(8),
    });
    const lbShape = computeLosersBracketShape(8);
    const lbFinal = lb(b).find(m => m.round === lbShape.length)!;
    const gf1 = gf(b).find(g => g.round === 1)!;
    expect(lbFinal.nextMatchId).toBe(gf1.id);
    expect(lbFinal.nextMatchSlot).toBe(2);
  });
});

describe('reportDoubleElimMatchResult', () => {
  it('throws error for invalid match', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    expect(() => reportDoubleElimMatchResult(b, 'invalid', 'player_1')).toThrow('not found');
  });

  it('throws error for invalid winner', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const r1m1 = wb(b).find(m => m.round === 1 && m.position === 1)!;
    expect(() => reportDoubleElimMatchResult(b, r1m1.id, 'invalid')).toThrow('not a participant');
  });

  it('advances WB winner to next WB match', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const r1m1 = wb(b).find(m => m.round === 1 && m.position === 1)!;
    const updated = reportDoubleElimMatchResult(b, r1m1.id, 'player_1');
    const completed = updated.matches.find(m => m.id === r1m1.id)!;
    expect(completed.winner).toBe('player_1');
    expect(completed.status).toBe('completed');
    const wbFinal = updated.matches.find(m => m.bracketType === 'winners' && m.round === 2)!;
    expect(wbFinal.participant1).toBe('player_1');
  });

  it('sends WB loser to LB', () => {
    const b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const r1m1 = wb(b).find(m => m.round === 1 && m.position === 1)!;
    const updated = reportDoubleElimMatchResult(b, r1m1.id, 'player_1');
    // player_4 (loser) should appear in LB R1.
    const lbR1 = updated.matches.filter(m => m.bracketType === 'losers' && m.round === 1);
    const hasPlayer4 = lbR1.some(m => m.participant1 === 'player_4' || m.participant2 === 'player_4');
    expect(hasPlayer4).toBe(true);
  });

  it('handles GF1 — WB-bracket player wins → tournament over (GF2 marked bye)', () => {
    let bracket = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const gf1 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1)!;

    // Manually set up GF1 for testing.
    bracket = {
      ...bracket,
      matches: bracket.matches.map(m =>
        m.id === gf1.id
          ? {
              ...m,
              participant1: 'player_1',
              participant1Seed: 1,
              participant2: 'player_2',
              participant2Seed: 2,
              status: 'ready' as const,
            }
          : m
      ),
    };

    const updated = reportDoubleElimMatchResult(bracket, gf1.id, 'player_1');
    const gf2 = updated.matches.find(m => m.bracketType === 'grand_final' && m.round === 2)!;
    expect(gf2.status).toBe('bye');
  });

  it('handles GF1 — LB-bracket player wins → reset GF2 ready', () => {
    let bracket = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });
    const gf1 = bracket.matches.find(m => m.bracketType === 'grand_final' && m.round === 1)!;

    bracket = {
      ...bracket,
      matches: bracket.matches.map(m =>
        m.id === gf1.id
          ? {
              ...m,
              participant1: 'player_1',
              participant1Seed: 1,
              participant2: 'player_2',
              participant2Seed: 2,
              status: 'ready' as const,
            }
          : { ...m }
      ),
    };

    const updated = reportDoubleElimMatchResult(bracket, gf1.id, 'player_2');
    const gf2 = updated.matches.find(m => m.bracketType === 'grand_final' && m.round === 2)!;
    expect(gf2.status).toBe('ready');
    expect(gf2.participant1).toBe('player_1');
    expect(gf2.participant2).toBe('player_2');
  });

  it('simulates a full 4-player DE tournament where seed 1 wins everything', () => {
    let b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(4),
    });

    // Play all WB matches. Winner = lower-seeded player.
    while (true) {
      const ready = b.matches.find(m => m.bracketType === 'winners' && m.status === 'ready');
      if (!ready) break;
      const winnerId =
        (ready.participant1Seed ?? Infinity) <= (ready.participant2Seed ?? Infinity)
          ? ready.participant1!
          : ready.participant2!;
      b = reportDoubleElimMatchResult(b, ready.id, winnerId);
    }

    // Play all LB matches similarly.
    while (true) {
      const ready = b.matches.find(m => m.bracketType === 'losers' && m.status === 'ready');
      if (!ready) break;
      const winnerId =
        (ready.participant1Seed ?? Infinity) <= (ready.participant2Seed ?? Infinity)
          ? ready.participant1!
          : ready.participant2!;
      b = reportDoubleElimMatchResult(b, ready.id, winnerId);
    }

    // GF1 should be ready with seed 1 (WB winner) vs LB winner.
    const gf1 = b.matches.find(m => m.bracketType === 'grand_final' && m.round === 1)!;
    expect(gf1.status).toBe('ready');
    expect(gf1.participant1).toBe('player_1');

    b = reportDoubleElimMatchResult(b, gf1.id, 'player_1');
    const gf2 = b.matches.find(m => m.bracketType === 'grand_final' && m.round === 2)!;
    expect(gf2.status).toBe('bye');
  });

  it('simulates a full 13-player DE tournament where seed 1 wins everything', () => {
    let b = generateDoubleElimination({
      tournamentId: 't',
      participants: createParticipants(13),
    });

    // Helper: play all ready matches in a given bracket type until none left.
    const playReady = (bracketType: 'winners' | 'losers'): void => {
      while (true) {
        const ready = b.matches.find(m => m.bracketType === bracketType && m.status === 'ready');
        if (!ready) break;
        const winnerId =
          (ready.participant1Seed ?? Infinity) <= (ready.participant2Seed ?? Infinity)
            ? ready.participant1!
            : ready.participant2!;
        b = reportDoubleElimMatchResult(b, ready.id, winnerId);
      }
    };

    // Interleave: WB and LB matches may become ready at different times.
    // Loop until no ready non-GF match exists.
    let iterations = 0;
    while (true) {
      const before = b.matches.filter(m => m.status === 'ready' && m.bracketType !== 'grand_final').length;
      if (before === 0) break;
      playReady('winners');
      playReady('losers');
      iterations++;
      if (iterations > 100) throw new Error('Tournament simulation stuck');
    }

    // GF1 should now be ready.
    const gf1 = b.matches.find(m => m.bracketType === 'grand_final' && m.round === 1)!;
    expect(gf1.status).toBe('ready');
    // WB winner (seed 1) should be in slot 1.
    expect(gf1.participant1).toBe('player_1');

    b = reportDoubleElimMatchResult(b, gf1.id, 'player_1');
    const finalGF1 = b.matches.find(m => m.id === gf1.id)!;
    expect(finalGF1.status).toBe('completed');
    expect(finalGF1.winner).toBe('player_1');
  });
});
