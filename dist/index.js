export * from './types.js';
export * from './utils.js';
export { generateSingleElimination, reportMatchResult } from './single-elimination.js';
export { generateDoubleElimination, reportDoubleElimMatchResult, propagateByes } from './double-elimination.js';
import { generateSingleElimination } from './single-elimination.js';
import { generateDoubleElimination } from './double-elimination.js';
/**
 * Generate a tournament bracket
 */
export function generateBracket(options) {
    const { format, tournamentId, participants } = options;
    if (format === 'single_elim') {
        return generateSingleElimination({ tournamentId, participants });
    }
    else if (format === 'double_elim') {
        return generateDoubleElimination({ tournamentId, participants });
    }
    throw new Error(`Unsupported bracket format: ${format}`);
}
//# sourceMappingURL=index.js.map