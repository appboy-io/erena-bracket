export type BracketType = 'winners' | 'losers' | 'grand_final';

export type MatchStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'bye' | 'disqualified';

export interface Participant {
  id: string;
  seed: number;
  name?: string;
}

export interface Match {
  id: string;
  round: number;
  position: number;
  bracketType: BracketType;
  participant1: string | null;
  participant2: string | null;
  participant1Seed: number | null;
  participant2Seed: number | null;
  winner: string | null;
  status: MatchStatus;
  nextMatchId: string | null;
  nextMatchSlot: 1 | 2 | null;
  loserNextMatchId: string | null;
  loserNextMatchSlot: 1 | 2 | null;
}

export interface Bracket {
  tournamentId: string;
  format: 'single_elim' | 'double_elim';
  matches: Match[];
  totalRounds: number;
  participantCount: number;
}

export interface BracketGeneratorOptions {
  tournamentId: string;
  participants: Participant[];
  format: 'single_elim' | 'double_elim';
  bestOf?: number;
}
