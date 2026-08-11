import { Check } from "lucide-react";
import type { Player } from "@/lib/supabase/types";
import { groupLabel, tieOnQualifyingLine, type GroupView } from "@/lib/groups";
import { playerName } from "@/lib/players";
import type { Dict } from "@/lib/i18n/dictionary";

/** A lone + or − is a neutral character, so an Arabic page hangs it off the
 * wrong end of the digits and +5 reads as 5+. Every cell showing one is pinned
 * to ltr; being centred, it looks the same in both languages. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * One group's table. Rows are already ranked by `computeStandings` — table
 * points first, scored points only as a tie-break — and the qualifying places
 * are marked as long as the group is still deciding them.
 */
export function GroupTable({
  group,
  players,
  advance,
  t,
}: {
  group: GroupView;
  players: Player[];
  advance: number;
  t: Dict;
}) {
  const qualifies = (i: number) => i < advance;
  // Players the table can't separate across the qualifying line: level while
  // the group is still running, and a decider waiting to be played once it
  // isn't. A pin means that decider was played, so the note stands down.
  const notes = new Map<string, string>();
  if (group.pinned.length > 0) {
    for (const id of group.pinned) notes.set(id, t.groups.pinnedNote);
  } else {
    const label = group.complete ? t.groups.tieNeedsDecider : t.groups.tiedNote;
    for (const row of tieOnQualifyingLine(group.standings, advance)) notes.set(row.playerId, label);
  }

  return (
    <div className="liquid-glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-fg/[0.07] px-4 py-3">
        <h3 className="font-medium text-fg">
          {t.groups.group} {groupLabel(group.groupNo)}
        </h3>
        <span className="shrink-0 text-[12px] text-fg/70">
          {group.complete ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <Check size={12} strokeWidth={2.5} />
              {t.groups.complete}
            </span>
          ) : (
            `${group.played}/${group.total} ${t.groups.progress}`
          )}
        </span>
      </div>

      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-fg/55">
              <th className="w-8 px-2 py-2 text-center font-normal">#</th>
              <th className="px-2 py-2 text-start font-normal">{t.groups.player}</th>
              <th className="w-9 px-1 py-2 text-center font-normal">{t.groups.played}</th>
              <th className="w-9 px-1 py-2 text-center font-normal">{t.groups.wins}</th>
              <th className="w-9 px-1 py-2 text-center font-normal">{t.groups.losses}</th>
              <th className="w-12 px-1 py-2 text-center font-normal">{t.groups.diff}</th>
              <th className="w-10 px-1 py-2 text-center font-normal">{t.groups.pointsFor}</th>
              <th className="w-10 px-1 py-2 text-center font-normal text-fg/70">{t.groups.points}</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row, i) => (
              <tr
                key={row.playerId}
                className={`border-t border-fg/[0.05] ${qualifies(i) ? "bg-accent/[0.06]" : ""}`}
              >
                <td className="px-2 py-2.5 text-center text-xs tabular-nums text-fg/55">
                  {qualifies(i) ? (
                    <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-accent/20 font-semibold text-accent">
                      {i + 1}
                    </span>
                  ) : (
                    i + 1
                  )}
                </td>
                <td className="max-w-0 px-2 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`truncate ${qualifies(i) ? "font-semibold text-fg" : "text-fg/70"}`}
                    >
                      {playerName(players, row.playerId)}
                    </span>
                    {notes.has(row.playerId) && (
                      <span className="shrink-0 text-[11px] text-fg/45">{notes.get(row.playerId)}</span>
                    )}
                  </div>
                </td>
                <td className="px-1 py-2.5 text-center tabular-nums text-fg/55">{row.played}</td>
                <td className="px-1 py-2.5 text-center tabular-nums text-fg/70">{row.wins}</td>
                <td className="px-1 py-2.5 text-center tabular-nums text-fg/70">{row.losses}</td>
                <td dir="ltr" className="px-1 py-2.5 text-center tabular-nums text-fg/70">
                  {signed(row.pointDiff)}
                </td>
                <td className="px-1 py-2.5 text-center tabular-nums text-fg/55">{row.pointsFor}</td>
                <td className="px-1 py-2.5 text-center font-semibold tabular-nums text-fg">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
