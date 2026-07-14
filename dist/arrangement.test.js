import { describe, it, expect } from 'vitest';
import { generateFromArrangement, generateBracket } from './index.js';
import { slotsFromSeeding } from './utils.js';
function pa(n) {
    return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1, name: `P${i + 1}` }));
}
describe('generateFromArrangement', () => {
    it('equals generateBracket when given the standard arrangement (double_elim, 12)', () => {
        const parts = pa(12);
        const std = generateBracket({ tournamentId: 't', participants: parts, format: 'double_elim' });
        const slots = slotsFromSeeding(parts, 16);
        const arr = generateFromArrangement({ tournamentId: 't', format: 'double_elim', slots });
        expect(arr.matches).toEqual(std.matches);
    });
    it('dead double-bye match is marked (winner null) via propagateByes (double_elim)', () => {
        // 5 players in 8 slots; put two byes in the SAME round-1 match (slots 2,3)
        const [a, b, c, d, e] = pa(5);
        const arr = generateFromArrangement({
            tournamentId: 't', format: 'double_elim', slots: [a, b, null, null, c, d, e, null],
        });
        const wr1m2 = arr.matches.find((m) => m.bracketType === 'winners' && m.round === 1 && m.position === 2);
        expect(wr1m2.participant1).toBeNull();
        expect(wr1m2.participant2).toBeNull();
        expect(wr1m2.winner).toBeNull(); // dead double-bye
    });
    it('single_elim arbitrary arrangement builds', () => {
        const [a, b, c] = pa(3);
        const arr = generateFromArrangement({ tournamentId: 't', format: 'single_elim', slots: [null, a, b, c] });
        expect(arr.format).toBe('single_elim');
    });
});
//# sourceMappingURL=arrangement.test.js.map