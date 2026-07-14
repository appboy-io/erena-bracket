export * from './types.js';
export * from './utils.js';
export { generateSingleElimination, reportMatchResult, buildSingleElimination } from './single-elimination.js';
export { generateDoubleElimination, reportDoubleElimMatchResult, propagateByes, buildDoubleElimination, } from './double-elimination.js';
import type { Bracket, BracketGeneratorOptions, Participant } from './types.js';
/**
 * Generate a tournament bracket
 */
export declare function generateBracket(options: BracketGeneratorOptions): Bracket;
export interface ArrangementOptions {
    tournamentId: string;
    format: 'single_elim' | 'double_elim';
    slots: (Participant | null)[];
}
/**
 * Generate a tournament bracket from an explicit, arbitrary round-1 slot
 * arrangement rather than from a seeded participant list. Enables
 * start.gg-style on-bracket seeding editing.
 */
export declare function generateFromArrangement(options: ArrangementOptions): Bracket;
//# sourceMappingURL=index.d.ts.map