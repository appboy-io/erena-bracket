export * from './types.js';
export * from './utils.js';
export { generateSingleElimination, reportMatchResult } from './single-elimination.js';
export { generateDoubleElimination, reportDoubleElimMatchResult, propagateByes } from './double-elimination.js';
import type { Bracket, BracketGeneratorOptions } from './types.js';
/**
 * Generate a tournament bracket
 */
export declare function generateBracket(options: BracketGeneratorOptions): Bracket;
//# sourceMappingURL=index.d.ts.map