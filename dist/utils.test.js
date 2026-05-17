import { describe, it, expect } from 'vitest';
import { nextPowerOf2, isPowerOf2, calculateRounds, generateSeedOrder, assignByes, computeRoundCounts, computeRoundByes, compressedSeedOrder, computeLosersBracketShape, } from './utils.js';
describe('nextPowerOf2', () => {
    it('returns 1 for 0 or 1', () => {
        expect(nextPowerOf2(0)).toBe(1);
        expect(nextPowerOf2(1)).toBe(1);
    });
    it('returns same number if already power of 2', () => {
        expect(nextPowerOf2(2)).toBe(2);
        expect(nextPowerOf2(4)).toBe(4);
        expect(nextPowerOf2(8)).toBe(8);
        expect(nextPowerOf2(16)).toBe(16);
    });
    it('returns next power of 2 for non-powers', () => {
        expect(nextPowerOf2(3)).toBe(4);
        expect(nextPowerOf2(5)).toBe(8);
        expect(nextPowerOf2(6)).toBe(8);
        expect(nextPowerOf2(7)).toBe(8);
        expect(nextPowerOf2(9)).toBe(16);
        expect(nextPowerOf2(12)).toBe(16);
    });
});
describe('isPowerOf2', () => {
    it('returns true for powers of 2', () => {
        expect(isPowerOf2(1)).toBe(true);
        expect(isPowerOf2(2)).toBe(true);
        expect(isPowerOf2(4)).toBe(true);
        expect(isPowerOf2(8)).toBe(true);
        expect(isPowerOf2(16)).toBe(true);
        expect(isPowerOf2(32)).toBe(true);
    });
    it('returns false for non-powers of 2', () => {
        expect(isPowerOf2(0)).toBe(false);
        expect(isPowerOf2(3)).toBe(false);
        expect(isPowerOf2(5)).toBe(false);
        expect(isPowerOf2(6)).toBe(false);
        expect(isPowerOf2(7)).toBe(false);
        expect(isPowerOf2(9)).toBe(false);
    });
});
describe('calculateRounds', () => {
    it('returns 0 for 0 or 1 participants', () => {
        expect(calculateRounds(0)).toBe(0);
        expect(calculateRounds(1)).toBe(0);
    });
    it('returns correct rounds for power of 2 participants', () => {
        expect(calculateRounds(2)).toBe(1);
        expect(calculateRounds(4)).toBe(2);
        expect(calculateRounds(8)).toBe(3);
        expect(calculateRounds(16)).toBe(4);
        expect(calculateRounds(32)).toBe(5);
    });
    it('returns correct rounds for non-power of 2 participants', () => {
        expect(calculateRounds(3)).toBe(2);
        expect(calculateRounds(5)).toBe(3);
        expect(calculateRounds(6)).toBe(3);
        expect(calculateRounds(7)).toBe(3);
        expect(calculateRounds(9)).toBe(4);
    });
});
describe('generateSeedOrder', () => {
    it('returns [1] for bracket size 1', () => {
        expect(generateSeedOrder(1)).toEqual([1]);
    });
    it('returns [1, 2] for bracket size 2', () => {
        expect(generateSeedOrder(2)).toEqual([1, 2]);
    });
    it('returns correct order for 4 participants', () => {
        expect(generateSeedOrder(4)).toEqual([1, 4, 2, 3]);
    });
    it('returns correct order for 8 participants', () => {
        const order = generateSeedOrder(8);
        expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    });
    it('returns correct order for 16 participants', () => {
        const order = generateSeedOrder(16);
        expect(order.length).toBe(16);
        expect(order[0]).toBe(1);
        expect(order[1]).toBe(16);
        expect(order[2]).toBe(8);
        expect(order[3]).toBe(9);
    });
});
describe('assignByes (legacy power-of-2 model, still used by DE)', () => {
    it('returns empty set when participants equal bracket size', () => {
        const byes = assignByes(8, 8);
        expect(byes.size).toBe(0);
    });
    it('returns the phantom seed positions (those above participantCount)', () => {
        const byes = assignByes(6, 8);
        expect(byes.size).toBe(2);
        expect(byes.has(7)).toBe(true);
        expect(byes.has(8)).toBe(true);
        expect(byes.has(1)).toBe(false);
    });
    it('handles 13 participants in a 16-slot bracket', () => {
        const byes = assignByes(13, 16);
        expect(byes.size).toBe(3);
        expect(byes.has(14)).toBe(true);
        expect(byes.has(15)).toBe(true);
        expect(byes.has(16)).toBe(true);
    });
});
describe('computeRoundCounts (flow-byes match counts per round)', () => {
    it('returns empty for fewer than 2 players', () => {
        expect(computeRoundCounts(0)).toEqual([]);
        expect(computeRoundCounts(1)).toEqual([]);
    });
    it('handles power-of-2 sizes', () => {
        expect(computeRoundCounts(2)).toEqual([1]);
        expect(computeRoundCounts(4)).toEqual([2, 1]);
        expect(computeRoundCounts(8)).toEqual([4, 2, 1]);
        expect(computeRoundCounts(16)).toEqual([8, 4, 2, 1]);
        expect(computeRoundCounts(32)).toEqual([16, 8, 4, 2, 1]);
    });
    it('handles 3 players', () => {
        expect(computeRoundCounts(3)).toEqual([1, 1]);
    });
    it('handles 5 players', () => {
        expect(computeRoundCounts(5)).toEqual([2, 1, 1]);
    });
    it('handles 6 players', () => {
        expect(computeRoundCounts(6)).toEqual([3, 1, 1]);
    });
    it('handles 7 players', () => {
        expect(computeRoundCounts(7)).toEqual([3, 2, 1]);
    });
    it('handles 13 players (canonical flow-bye example)', () => {
        expect(computeRoundCounts(13)).toEqual([6, 3, 2, 1]);
    });
    it('handles 17 players', () => {
        expect(computeRoundCounts(17)).toEqual([8, 4, 2, 1, 1]);
    });
    it('sums to N-1 for any N', () => {
        for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 13, 16, 17, 32, 33, 100]) {
            const counts = computeRoundCounts(n);
            const total = counts.reduce((a, b) => a + b, 0);
            expect(total).toBe(n - 1);
        }
    });
});
describe('computeRoundByes', () => {
    it('returns empty for fewer than 2 players', () => {
        expect(computeRoundByes(0)).toEqual([]);
        expect(computeRoundByes(1)).toEqual([]);
    });
    it('returns all zeros for power-of-2 sizes', () => {
        expect(computeRoundByes(2)).toEqual([0]);
        expect(computeRoundByes(4)).toEqual([0, 0]);
        expect(computeRoundByes(8)).toEqual([0, 0, 0]);
        expect(computeRoundByes(16)).toEqual([0, 0, 0, 0]);
    });
    it('handles 3 players', () => {
        expect(computeRoundByes(3)).toEqual([1, 0]);
    });
    it('handles 5 players', () => {
        expect(computeRoundByes(5)).toEqual([1, 1, 0]);
    });
    it('handles 13 players', () => {
        expect(computeRoundByes(13)).toEqual([1, 1, 0, 0]);
    });
    it('handles 17 players', () => {
        expect(computeRoundByes(17)).toEqual([1, 1, 1, 1, 0]);
    });
    it('round counts and byes are consistent with alive sequence', () => {
        for (const n of [2, 3, 5, 7, 13, 17, 33]) {
            const counts = computeRoundCounts(n);
            const byes = computeRoundByes(n);
            expect(counts.length).toBe(byes.length);
            let alive = n;
            for (let i = 0; i < counts.length; i++) {
                expect(counts[i]).toBe(Math.floor(alive / 2));
                expect(byes[i]).toBe(alive % 2);
                alive = counts[i] + byes[i];
            }
            expect(alive).toBe(1);
        }
    });
});
describe('compressedSeedOrder', () => {
    it('returns [1] for n=1', () => {
        expect(compressedSeedOrder(1)).toEqual([1]);
    });
    it('matches generateSeedOrder for powers of 2', () => {
        expect(compressedSeedOrder(2)).toEqual(generateSeedOrder(2));
        expect(compressedSeedOrder(4)).toEqual(generateSeedOrder(4));
        expect(compressedSeedOrder(8)).toEqual(generateSeedOrder(8));
        expect(compressedSeedOrder(16)).toEqual(generateSeedOrder(16));
    });
    it('drops phantom positions for non-powers', () => {
        expect(compressedSeedOrder(13)).toEqual([1, 8, 9, 4, 13, 5, 12, 2, 7, 10, 3, 6, 11]);
    });
    it('always starts with seed 1', () => {
        for (const n of [2, 3, 5, 7, 13, 17]) {
            expect(compressedSeedOrder(n)[0]).toBe(1);
        }
    });
    it('produces a permutation of seeds 1..n', () => {
        for (const n of [3, 5, 6, 7, 13, 17, 23]) {
            const order = compressedSeedOrder(n);
            const sorted = [...order].sort((a, b) => a - b);
            expect(sorted).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        }
    });
});
describe('computeLosersBracketShape (flow-byes DE losers bracket)', () => {
    it('returns empty for fewer than 2 players', () => {
        expect(computeLosersBracketShape(0)).toEqual([]);
        expect(computeLosersBracketShape(1)).toEqual([]);
    });
    it('returns empty for N=2 (WB has 1 round → no LB)', () => {
        expect(computeLosersBracketShape(2)).toEqual([]);
    });
    it('produces correct shape for N=4 (power of 2)', () => {
        const shape = computeLosersBracketShape(4);
        expect(shape.length).toBe(2);
        // L1: drop-in WB R1 (2 losers), 1 match, 0 byes, 1 advance.
        expect(shape[0]).toMatchObject({
            round: 1,
            isDropIn: true,
            carryover: 0,
            dropIn: 2,
            alive: 2,
            matches: 1,
            byes: 0,
            advances: 1,
            wbLoserFeedRound: 1,
        });
        // L2: drop-in WB R2 (1 loser) + 1 carryover, 1 match, 0 byes.
        expect(shape[1]).toMatchObject({
            round: 2,
            isDropIn: true,
            carryover: 1,
            dropIn: 1,
            alive: 2,
            matches: 1,
            byes: 0,
            advances: 1,
            wbLoserFeedRound: 2,
        });
    });
    it('produces correct shape for N=8 (power of 2)', () => {
        const shape = computeLosersBracketShape(8);
        expect(shape.length).toBe(4);
        expect(shape.map(r => r.matches)).toEqual([2, 2, 1, 1]);
        expect(shape.map(r => r.byes)).toEqual([0, 0, 0, 0]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(6); // N-2
    });
    it('produces correct shape for N=13 (canonical flow-byes case)', () => {
        const shape = computeLosersBracketShape(13);
        expect(shape.length).toBe(6);
        expect(shape.map(r => r.matches)).toEqual([3, 3, 1, 2, 1, 1]);
        expect(shape.map(r => r.byes)).toEqual([0, 0, 1, 0, 0, 0]);
        expect(shape.map(r => r.alive)).toEqual([6, 6, 3, 4, 2, 2]);
        expect(shape.map(r => r.advances)).toEqual([3, 3, 2, 2, 1, 1]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(11); // N-2
        // L3 is consolidate, L1/L2/L4/L6 are drop-in.
        expect(shape.map(r => r.isDropIn)).toEqual([true, true, false, true, false, true]);
        // L1 → WB R1, L2 → WB R2, L4 → WB R3, L6 → WB R4. Consolidates → null.
        expect(shape.map(r => r.wbLoserFeedRound)).toEqual([1, 2, null, 3, null, 4]);
    });
    it('produces correct shape for N=5', () => {
        // WB = [2, 1, 1], LB rounds = 4.
        const shape = computeLosersBracketShape(5);
        expect(shape.length).toBe(4);
        // L1: 2 alive, 1 match. L2: 1+1=2, 1 match. L3: 1 alive, 0 matches, 1 bye.
        // L4: 1+1=2, 1 match.
        expect(shape.map(r => r.matches)).toEqual([1, 1, 0, 1]);
        expect(shape.map(r => r.byes)).toEqual([0, 0, 1, 0]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(3); // N-2
    });
    it('produces correct shape for N=6', () => {
        // WB = [3, 1, 1]. LB rounds = 4.
        const shape = computeLosersBracketShape(6);
        expect(shape.length).toBe(4);
        // L1: 3 alive, 1 match, 1 bye, 2 advance.
        // L2: 2+1=3, 1 match, 1 bye, 2 advance.
        // L3: 2 alive, 1 match, 0 byes, 1 advance.
        // L4: 1+1=2, 1 match, 0 byes.
        expect(shape.map(r => r.matches)).toEqual([1, 1, 1, 1]);
        expect(shape.map(r => r.byes)).toEqual([1, 1, 0, 0]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(4); // N-2
    });
    it('produces correct shape for N=16 (power of 2)', () => {
        const shape = computeLosersBracketShape(16);
        expect(shape.length).toBe(6);
        expect(shape.map(r => r.matches)).toEqual([4, 4, 2, 2, 1, 1]);
        expect(shape.map(r => r.byes)).toEqual([0, 0, 0, 0, 0, 0]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(14); // N-2
    });
    it('produces correct shape for N=17', () => {
        // WB = [8,4,2,1,1], WB rounds=5, LB rounds=8.
        const shape = computeLosersBracketShape(17);
        expect(shape.length).toBe(8);
        expect(shape.map(r => r.matches)).toEqual([4, 4, 2, 2, 1, 1, 0, 1]);
        expect(shape.map(r => r.byes)).toEqual([0, 0, 0, 0, 0, 0, 1, 0]);
        const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
        expect(totalMatches).toBe(15); // N-2
    });
    it('LB match total equals N-2 for many N', () => {
        for (const n of [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 16, 17, 23, 32, 33, 64]) {
            const shape = computeLosersBracketShape(n);
            const totalMatches = shape.reduce((s, r) => s + r.matches, 0);
            expect(totalMatches).toBe(n - 2);
        }
    });
    it('carryover always equals previous round advances', () => {
        for (const n of [4, 5, 6, 7, 11, 13, 17, 23, 33]) {
            const shape = computeLosersBracketShape(n);
            for (let i = 1; i < shape.length; i++) {
                expect(shape[i].carryover).toBe(shape[i - 1].advances);
            }
            // L1 has no carryover.
            expect(shape[0].carryover).toBe(0);
        }
    });
    it('carryover and dropIn never differ by more than 1', () => {
        // Invariant the LB generator relies on for clean pairing in drop-in rounds.
        for (const n of [3, 4, 5, 6, 7, 8, 11, 12, 13, 16, 17, 23, 32, 33]) {
            const shape = computeLosersBracketShape(n);
            for (const r of shape) {
                if (r.isDropIn && r.round > 1) {
                    expect(Math.abs(r.carryover - r.dropIn)).toBeLessThanOrEqual(1);
                }
            }
        }
    });
});
//# sourceMappingURL=utils.test.js.map