/** 'G' is a group-stage round-robin match; everything else is a knockout round.
 * '3P' is the third-place match: it hangs off the tree rather than in it, and
 * its two players are the losing semifinalists. */
export type Round = "G" | "R1" | "R16" | "QF" | "SF" | "3P" | "F" | "judge";
export type OutcomeType = "pending" | "score" | "absent" | "withdrew" | "bye";
/** idle = not started, live = papers being read out, done = bracket built. */
export type DrawStatus = "idle" | "live" | "done";
/** knockout = straight to the tree, groups = round-robin groups then the tree. */
export type TournamentFormat = "knockout" | "groups";

/**
 * The qualifying places an admin settled by hand, group number to an ordered
 * list of players — the result of a decider played in the room and never
 * written down as a match. Group numbers arrive as jsonb object keys, so
 * they're strings.
 */
export type GroupTiebreaks = Record<string, string[]>;

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
  /** Group-stage matches only: which group (0-based). Null in the knockout. */
  group_no: number | null;
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
  draw_status: DrawStatus;
  /** Seats in the live draw, frozen when it starts so a late roster change
   * can't reshape the grid under the audience. Null until then. */
  draw_size: number | null;
  format: TournamentFormat;
  /** Groups format only: how many groups, and how many of each qualify. */
  group_count: number | null;
  advance_per_group: number | null;
  /** Qualifying places the admin picked by hand, group number to an ordered
   * list of player ids. A group missing from here is ranked by its results. */
  group_tiebreaks: GroupTiebreaks | null;
  updated_at: string;
}

/** One filled seat of the live draw. Seat i = match floor(i/2), side (i%2)+1. */
export interface DrawSlot {
  seat: number;
  player_id: string;
  created_at: string;
}

/** A quote from a player or spectator, typed in by the admin. player_id links
 * it back to a roster player when the admin picked one; null for spectators
 * or anyone typed in by hand. */
export interface Statement {
  id: string;
  name: string;
  quote: string;
  player_id: string | null;
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
        Insert: Partial<Omit<Statement, "player_id">> & { name: string; quote: string; player_id?: string | null };
        Update: Partial<Statement>;
      };
      draw_slots: {
        Row: DrawSlot;
        Insert: { seat: number; player_id: string };
        Update: Partial<DrawSlot>;
      };
    };
  };
}
