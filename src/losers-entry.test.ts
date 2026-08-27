import { describe, it, expect } from 'vitest';
import { planEntryShape } from './losers-entry.js';

describe('planEntryShape', () => {
	it('reduces 16 direct entrants to the 4 that winners round 1 produces', () => {
		// Top 24: winners bracket of 8, 16 straight into losers.
		const shape = planEntryShape(8, 16);
		expect(shape.winnersRounds).toBe(3);
		expect(shape.entryRounds).toBe(2);
		expect(shape.entryMatchesPerRound).toEqual([8, 4]); // 16->8, 8->4
	});

	it('needs no entry round when the counts already meet', () => {
		const shape = planEntryShape(8, 4);
		expect(shape.entryRounds).toBe(0);
		expect(shape.entryMatchesPerRound).toEqual([]);
	});

	it('adds one round per doubling', () => {
		expect(planEntryShape(8, 8).entryRounds).toBe(1);
		expect(planEntryShape(8, 16).entryRounds).toBe(2);
		expect(planEntryShape(8, 32).entryRounds).toBe(3);
	});

	it('counts total losers rounds as entry rounds plus the standard ones', () => {
		// The standard portion is 2W-1 rounds, not 2(W-1): a normal LR1 merges AND
		// halves (winners round 1's losers pair each other), whereas an entry merge
		// round only merges, so it needs a reduce round of its own.
		//   8x16: LR1 8  LR2 4 | LR3 4  LR4 2 | LR5 2  LR6 1 | LR7 1
		expect(planEntryShape(8, 16).losersRounds).toBe(7);
		expect(planEntryShape(8, 4).losersRounds).toBe(5);
		expect(planEntryShape(16, 32).losersRounds).toBe(9);
	});

	it('rejects a direct-entrant count that cannot reduce cleanly', () => {
		// 6 does not halve down to 4
		expect(() => planEntryShape(8, 6)).toThrow(/cannot reduce/i);
		// fewer than the winners round 1 losers has nothing to merge against
		expect(() => planEntryShape(8, 2)).toThrow(/at least/i);
	});

	it('rejects a non-power-of-two winners bracket', () => {
		expect(() => planEntryShape(12, 8)).toThrow(/power of two/i);
	});

	it('every match eliminates exactly one player, and one champion remains', () => {
		// The identity that proves the shape is sound: a double-elim of N players
		// needs N-1 eliminations, and only losers matches plus the grand final
		// eliminate.
		const cases: Array<[number, number]> = [[8, 8], [8, 16], [16, 16], [16, 32], [32, 32]];
		for (const [bracketSize, direct] of cases) {
			const shape = planEntryShape(bracketSize, direct);
			const players = bracketSize + direct;

			const entryMatches = shape.entryMatchesPerRound.reduce((a, b) => a + b, 0);
			// standard losers matches for a bracket of this size
			let standard = 0;
			for (let count = bracketSize / 2; count >= 1; count /= 2) {
				standard += count;   // merge round
				if (count > 1) standard += count / 2; // reduce round
			}
			const losersMatches = entryMatches + standard;

			expect(losersMatches + 1, `${players} players`).toBe(players - 1);
		}
	});
});
