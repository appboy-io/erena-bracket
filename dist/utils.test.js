import { describe, it, expect } from 'vitest';
import { nextPowerOf2, isPowerOf2, calculateRounds, generateSeedOrder, assignByes, } from './utils.js';
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
        // 1v4, 2v3 -> ensures 1 and 2 meet in finals
        expect(generateSeedOrder(4)).toEqual([1, 4, 2, 3]);
    });
    it('returns correct order for 8 participants', () => {
        // Standard seeding: 1v8, 4v5, 2v7, 3v6
        // Ensures 1v2 can happen in finals, 1v4 or 2v3 in semis
        const order = generateSeedOrder(8);
        expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    });
    it('returns correct order for 16 participants', () => {
        const order = generateSeedOrder(16);
        expect(order.length).toBe(16);
        // First match should be 1 vs 16
        expect(order[0]).toBe(1);
        expect(order[1]).toBe(16);
        // Second match should be 8 vs 9
        expect(order[2]).toBe(8);
        expect(order[3]).toBe(9);
    });
});
describe('assignByes', () => {
    it('returns empty set when participants equal bracket size', () => {
        const byes = assignByes(8, 8);
        expect(byes.size).toBe(0);
    });
    it('assigns byes to top seeds', () => {
        // 6 participants in bracket size 8 = 2 byes
        const byes = assignByes(6, 8);
        expect(byes.size).toBe(2);
        expect(byes.has(1)).toBe(true);
        expect(byes.has(2)).toBe(true);
        expect(byes.has(3)).toBe(false);
    });
    it('handles larger bye counts', () => {
        // 5 participants in bracket size 8 = 3 byes
        const byes = assignByes(5, 8);
        expect(byes.size).toBe(3);
        expect(byes.has(1)).toBe(true);
        expect(byes.has(2)).toBe(true);
        expect(byes.has(3)).toBe(true);
        expect(byes.has(4)).toBe(false);
    });
});
//# sourceMappingURL=utils.test.js.map