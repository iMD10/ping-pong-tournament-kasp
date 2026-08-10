import { createClient } from "@/lib/supabase/server";
import type { Match, Player, Statement, TournamentState } from "@/lib/supabase/types";

export async function getPlayers(): Promise<Player[]> {
  const supabase = createClient();
  const { data } = await supabase.from("players").select("*").order("name");
  return data ?? [];
}

export async function getMatches(): Promise<Match[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("matches")
    .select("*")
    .neq("round", "judge")
    .order("bracket_slot", { ascending: true });
  return (data ?? []) as Match[];
}

export async function getJudgeMatch(): Promise<Match | null> {
  const supabase = createClient();
  const { data } = await supabase.from("matches").select("*").eq("round", "judge").maybeSingle();
  return (data as Match) ?? null;
}

export async function getState(): Promise<TournamentState | null> {
  const supabase = createClient();
  const { data } = await supabase.from("tournament_state").select("*").single();
  return data ?? null;
}

export async function getStatements(): Promise<Statement[]> {
  const supabase = createClient();
  const { data } = await supabase.from("statements").select("*").order("created_at", { ascending: true });
  return data ?? [];
}

export { playerName } from "@/lib/players";
