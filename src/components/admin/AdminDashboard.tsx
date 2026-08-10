"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions";
import { PlayerManager } from "@/components/admin/PlayerManager";
import { DrawPanel } from "@/components/admin/DrawPanel";
import { MatchAdminRow } from "@/components/admin/MatchAdminRow";
import { JudgeMatchPanel } from "@/components/admin/JudgeMatchPanel";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { Match, Player, TournamentState } from "@/lib/supabase/types";

const ROUND_RANK: Record<string, number> = { R1: 0, R16: 1, QF: 2, SF: 3, F: 4, judge: 5 };

export function AdminDashboard({
  players,
  matches,
  judgeMatch,
  state,
}: {
  players: Player[];
  matches: Match[];
  judgeMatch: Match | null;
  state: TournamentState | null;
}) {
  useLiveRefresh();

  const sorted = [...matches].sort(
    (a, b) => (ROUND_RANK[a.round] ?? 9) - (ROUND_RANK[b.round] ?? 9) || a.bracket_slot - b.bracket_slot
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-fg">لوحة الإدارة</h1>
          <p className="mt-1 text-sm text-fg/70">كل شي يتحدث مباشرة عند الحفظ.</p>
        </div>
        <button
          onClick={() => signOut()}
          className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-fg/70 transition-colors hover:text-fg"
        >
          <LogOut size={15} />
          خروج
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlayerManager players={players} locked={!!state?.drawn} />
        <DrawPanel drawn={!!state?.drawn} playerCount={players.length} />
      </div>

      <JudgeMatchPanel championId={state?.champion_id ?? null} judgeMatch={judgeMatch} players={players} />

      {state?.drawn && (
        <div>
          <h2 className="mb-3 text-lg font-medium tracking-tight text-fg/90">المباريات</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {sorted.map((m) => (
              <MatchAdminRow key={m.id} match={m} players={players} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
