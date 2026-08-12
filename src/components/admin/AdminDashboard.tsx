"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions";
import { PlayerManager } from "@/components/admin/PlayerManager";
import { DrawPanel } from "@/components/admin/DrawPanel";
import { ManualDrawPanel } from "@/components/admin/ManualDrawPanel";
import { ManualGroupDrawPanel } from "@/components/admin/ManualGroupDrawPanel";
import { useGroupSettings } from "@/components/admin/useGroupSettings";
import { LiveDrawPanel } from "@/components/admin/LiveDrawPanel";
import { GroupsPanel } from "@/components/admin/GroupsPanel";
import { MatchAdminRow } from "@/components/admin/MatchAdminRow";
import { JudgeMatchPanel } from "@/components/admin/JudgeMatchPanel";
import { ShamatPanel } from "@/components/admin/ShamatPanel";
import { StatementsPanel } from "@/components/admin/StatementsPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import { byKickoff, byMostRecent, matchStatus } from "@/lib/match";
import type {
  DrawSlot,
  Match,
  Player,
  Statement,
  TournamentFormat,
  TournamentState,
} from "@/lib/supabase/types";

const ROUND_RANK: Record<string, number> = { G: -1, R1: 0, R16: 1, QF: 2, SF: 3, F: 4, judge: 5 };

export function AdminDashboard({
  players,
  matches,
  judgeMatch,
  state,
  statements,
  drawSlots,
}: {
  players: Player[];
  matches: Match[];
  judgeMatch: Match | null;
  state: TournamentState | null;
  statements: Statement[];
  drawSlots: DrawSlot[];
}) {
  useLiveRefresh(["matches", "tournament_state", "statements", "draw_slots"]);
  const [manualOpen, setManualOpen] = useState(false);
  const drawStatus = state?.draw_status ?? "idle";
  const liveDrawRunning = drawStatus === "live";

  // Before the draw this is the admin's pick; after it, it's what was drawn.
  const savedFormat = state?.format ?? "knockout";
  const [pickedFormat, setPickedFormat] = useState<TournamentFormat>(savedFormat);
  const format = state?.drawn ? savedFormat : pickedFormat;
  const groupsFormat = format === "groups";
  const knockoutStarted = matches.some((m) => m.round !== "G");
  // Shared by the draw panel and the by-hand arrangement, so the group count
  // and qualifier count mean the same thing in both.
  const groupSettings = useGroupSettings(players.length);

  const byBoardOrder = (a: Match, b: Match) =>
    (ROUND_RANK[a.round] ?? 9) - (ROUND_RANK[b.round] ?? 9) || a.bracket_slot - b.bracket_slot;

  // The board the admin actually works on is what's on the table and what's
  // next; everything already scored is filed behind a fold, newest on top, for
  // the times a score has to be fixed after the fact.
  const onTable = matches.filter((m) => matchStatus(m) === "live").sort(byBoardOrder);
  const toPlay = matches.filter((m) => matchStatus(m) === "upcoming").sort(byKickoff(byBoardOrder));
  const played = matches.filter((m) => matchStatus(m) === "finished").sort(byMostRecent);
  // Nothing on the table means the top of the queue is the one to set up next.
  const nextUpId = onTable.length === 0 ? toPlay[0]?.id : undefined;

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
        <DrawPanel
          drawn={!!state?.drawn}
          playerCount={players.length}
          format={format}
          onFormatChange={setPickedFormat}
          groups={groupSettings}
          manualOpen={manualOpen}
          onToggleManual={() => setManualOpen((v) => !v)}
          liveDrawRunning={liveDrawRunning}
        />
      </div>

      {!state?.drawn && !groupsFormat && !liveDrawRunning && manualOpen && players.length >= 2 && (
        // Remount when the roster size changes so the slot grid matches it.
        <ManualDrawPanel key={players.length} players={players} onClose={() => setManualOpen(false)} />
      )}

      {!state?.drawn && groupsFormat && !liveDrawRunning && manualOpen && groupSettings.possible && (
        // Same remount rule, plus the group count: both reshape the board.
        <ManualGroupDrawPanel
          key={`${players.length}-${groupSettings.count}`}
          players={players}
          settings={groupSettings}
          onClose={() => setManualOpen(false)}
        />
      )}

      {/* The on-air ceremony seats a knockout tree, so it stands down while the
          groups format is selected — unless one is already running. */}
      {!state?.drawn && (!groupsFormat || liveDrawRunning) && (
        <LiveDrawPanel
          players={players}
          slots={drawSlots}
          status={drawStatus}
          size={state?.draw_size ?? null}
        />
      )}

      {state?.drawn && groupsFormat && (
        <GroupsPanel
          matches={matches}
          players={players}
          advancePerGroup={state.advance_per_group ?? 2}
          tiebreaks={state.group_tiebreaks ?? null}
          knockoutStarted={knockoutStarted}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <StatementsPanel statements={statements} players={players} />
        <ShamatPanel state={state} />
      </div>

      <JudgeMatchPanel championId={state?.champion_id ?? null} judgeMatch={judgeMatch} players={players} />

      {state?.drawn && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium tracking-tight text-fg/90">المباريات</h2>

          {onTable.length + toPlay.length === 0 ? (
            <p className="liquid-glass-panel rounded-2xl px-6 py-10 text-center text-sm text-fg/70">
              ما به مباريات باقية، كلها انتهت.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {[...onTable, ...toPlay].map((m) => (
                <MatchAdminRow key={m.id} match={m} players={players} nextUp={m.id === nextUpId} />
              ))}
            </div>
          )}

          {played.length > 0 && (
            <CollapsibleSection
              title="مباريات انتهت"
              count={played.length}
              defaultOpen={onTable.length + toPlay.length === 0}
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {played.map((m) => (
                  <MatchAdminRow key={m.id} match={m} players={players} />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
