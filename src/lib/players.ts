import type { Player } from "@/lib/supabase/types";

export function playerName(players: Player[], id: string | null): string {
  if (!id) return "";
  return players.find((p) => p.id === id)?.name ?? "";
}
