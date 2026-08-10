export type Round = "R1" | "R16" | "QF" | "SF" | "F" | "judge";
export type OutcomeType = "pending" | "score" | "absent" | "withdrew" | "bye";

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface Game {
  score1: number;
  score2: number;
  decider_score1?: number;
  decider_score2?: number;
}

export interface Match {
  id: string;
  round: Round;
  bracket_slot: number;
  player1_id: string | null;
  player2_id: string | null;
  games: Game[];
  winner_id: string | null;
  outcome_type: OutcomeType;
  outcome_reason: string | null;
  scheduled_at: string | null;
  is_live: boolean;
  next_match_id: string | null;
  next_match_slot: number | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentState {
  id: number;
  drawn: boolean;
  event_date: string | null;
  champion_id: string | null;
  /** «أفضل شمات» — awarded by the admin, not computed from results. */
  best_shamat_name: string | null;
  best_shamat_quote: string | null;
  updated_at: string;
}

/** A quote from a player or spectator, typed in by the admin. */
export interface Statement {
  id: string;
  name: string;
  quote: string;
  created_at: string;
}

// Minimal hand-written Database type (no generated types needed for this project size)
export interface Database {
  public: {
    Tables: {
      players: {
        Row: Player;
        Insert: Partial<Player> & { name: string };
        Update: Partial<Player>;
      };
      matches: {
        Row: Match;
        Insert: Partial<Match>;
        Update: Partial<Match>;
      };
      tournament_state: {
        Row: TournamentState;
        Insert: Partial<TournamentState>;
        Update: Partial<TournamentState>;
      };
      statements: {
        Row: Statement;
        Insert: Partial<Statement> & { name: string; quote: string };
        Update: Partial<Statement>;
      };
    };
  };
}
