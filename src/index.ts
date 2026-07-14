export * from './types.js';
export * from './utils.js';
export { generateSingleElimination, reportMatchResult, buildSingleElimination } from './single-elimination.js';
export {
  generateDoubleElimination,
  reportDoubleElimMatchResult,
  propagateByes,
  buildDoubleElimination,
} from './double-elimination.js';

import type { Bracket, BracketGeneratorOptions, Participant } from './types.js';
import { generateSingleElimination, buildSingleElimination } from './single-elimination.js';
import { generateDoubleElimination, buildDoubleElimination } from './double-elimination.js';

/**
 * Generate a tournament bracket
 */
export function generateBracket(options: BracketGeneratorOptions): Bracket {
  const { format, tournamentId, participants } = options;

  if (format === 'single_elim') {
    return generateSingleElimination({ tournamentId, participants });
  } else if (format === 'double_elim') {
    return generateDoubleElimination({ tournamentId, participants });
  }

  throw new Error(`Unsupported bracket format: ${format}`);
}

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
export function generateFromArrangement(options: ArrangementOptions): Bracket {
  const { tournamentId, format, slots } = options;
  if ((slots.length & (slots.length - 1)) !== 0 || slots.length < 2) {
    throw new Error('slots length must be a power of two >= 2');
  }
  return format === 'double_elim'
    ? buildDoubleElimination(tournamentId, slots)
    : buildSingleElimination(tournamentId, slots);
}
