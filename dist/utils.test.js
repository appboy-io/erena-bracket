import { describe, it, expect } from 'vitest';
import { nextPowerOf2, isPowerOf2, calculateRounds, generateSeedOrder, assignByes, computeRoundCounts, computeRoundByes, compressedSeedOrder, } from './utils.js';
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
//# sourceMappingURL=utils.test.js.map