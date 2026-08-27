import { describe, it, expect } from 'vitest';
import { ENTRY_CROSSOVER_PLAN, entryCrossoverNameFor } from './double-elimination.js';
describe('ENTRY_CROSSOVER_PLAN', () => {
    it('covers every shape the search was run for', () => {
        for (const key of ['8x8', '8x16', '16x16', '16x32']) {
            expect(ENTRY_CROSSOVER_PLAN[key], `missing plan for ${key}`).toBeDefined();
        }
    });
    it('names one permutation per winners round', () => {
        // A winners bracket of 2^k has k rounds, each dropping into losers.
        const rounds = {
            '8x8': 3, '8x16': 3, '16x16': 4, '16x32': 4,
        };
        for (const [key, expected] of Object.entries(rounds)) {
            expect(ENTRY_CROSSOVER_PLAN[key].length, key).toBe(expected);
        }
    });
    it('only uses permutations the generator knows', () => {
        const known = new Set(['identity', 'reverse', 'halfswap', 'revhalf']);
        for (const [key, plan] of Object.entries(ENTRY_CROSSOVER_PLAN)) {
            for (const name of plan) {
                expect(known.has(name), `${key} uses unknown permutation ${name}`).toBe(true);
            }
        }
    });
    // 32 winners + 32 direct entrants is a real shape (planEntryShape accepts it)
    // but the exhaustive entry search is intractable there: at k=5 it must also
    // permute winners round 1 (16 seats), giving 16!x8!x4!x2!x1! ~= 4.05e19
    // arrangements. It is deliberately absent from the table, not forgotten.
    it('has no entry for 32x32 -- exhaustive search is intractable there', () => {
        expect(ENTRY_CROSSOVER_PLAN['32x32']).toBeUndefined();
    });
    it('falls back to identity for an unsearched shape', () => {
        for (let wRound = 1; wRound <= 5; wRound++) {
            expect(entryCrossoverNameFor(32, 32, wRound)).toBe('identity');
        }
    });
    it('looks up the searched shapes by winners round', () => {
        expect(entryCrossoverNameFor(8, 8, 1)).toBe('identity');
        expect(entryCrossoverNameFor(8, 8, 2)).toBe('reverse');
        expect(entryCrossoverNameFor(8, 8, 3)).toBe('identity');
        expect(entryCrossoverNameFor(16, 32, 2)).toBe('halfswap');
    });
});
//# sourceMappingURL=entry-crossover.test.js.map