import Link from "next/link";
import type { RankedStats } from "@/lib/stats";
import type { Dict } from "@/lib/i18n/dictionary";

/** A lone + or − is a neutral character, so an Arabic page hangs it off the
 * wrong end of the digits and +5 reads as 5+. Every cell showing one is pinned
 * to ltr; being centred, it looks the same in both languages. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * The whole field, ranked. Rows are already ordered by `rankStats` — wins
 * first, point difference and points scored as tie-breaks — and every row
 * links through to that player's own page.
 *
 * `limit` cuts it to a leaderboard for the hall page; the full table lives on
 * /players. Columns past the win/loss record are hidden on narrow screens so
 * the important half never scrolls out of reach.
 */
export function StatsTable({
  rows,
  t,
  limit,
  championId,
}: {
  rows: RankedStats[];
  t: Dict;
  limit?: number;
  championId?: string | null;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <div className="liquid-glass-panel overflow-hidden rounded-2xl">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-fg/55">
              <th className="w-8 px-2 py-2.5 text-center font-normal">{t.stats.rank}</th>
              <th className="px-2 py-2.5 text-start font-normal">{t.stats.player}</th>
              <th className="w-9 px-1 py-2.5 text-center font-normal">{t.stats.played}</th>
              <th className="w-9 px-1 py-2.5 text-center font-normal">{t.stats.wins}</th>
              <th className="w-9 px-1 py-2.5 text-center font-normal">{t.stats.losses}</th>
              <th className="hidden w-12 px-1 py-2.5 text-center font-normal sm:table-cell">{t.stats.winRate}</th>
              <th className="w-12 px-1 py-2.5 text-center font-normal">{t.stats.diff}</th>
              <th className="hidden w-10 px-1 py-2.5 text-center font-normal sm:table-cell">{t.stats.pointsFor}</th>
              <th className="hidden w-10 px-1 py-2.5 text-center font-normal sm:table-cell">{t.stats.pointsAgainst}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const podium = row.rank <= 3 && row.played > 0;
              return (
                <tr
                  key={row.playerId}
                  className={`border-t border-fg/[0.05] transition-colors hover:bg-fg/[0.04] ${
                    podium ? "bg-accent/[0.05]" : ""
                  }`}
                >
                  <td className="px-2 py-2.5 text-center text-xs tabular-nums text-fg/55">
                    {podium ? (
                      <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-accent/20 font-semibold text-accent">
                        {row.rank}
                      </span>
                    ) : (
                      // A player with no matches has no place in the table yet —
                      // showing a rank would put the whole untouched roster joint first.
                      row.played > 0 ? row.rank : "–"
                    )}
                  </td>
                  <td className="max-w-0 truncate px-2 py-2.5">
                    <Link
                      href={`/players/${row.playerId}`}
                      className={`hover:underline ${podium ? "font-semibold text-fg" : "text-fg/70"}`}
                    >
                      {row.name}
                    </Link>
                    {championId === row.playerId && <span className="ms-1.5">🏆</span>}
                  </td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-fg/55">{row.played}</td>
                  <td className="px-1 py-2.5 text-center font-semibold tabular-nums text-fg">{row.wins}</td>
                  <td className="px-1 py-2.5 text-center tabular-nums text-fg/70">{row.losses}</td>
                  <td className="hidden px-1 py-2.5 text-center tabular-nums text-fg/70 sm:table-cell">
                    {row.played > 0 ? `${Math.round(row.winRate * 100)}%` : "–"}
                  </td>
                  <td dir="ltr" className="px-1 py-2.5 text-center tabular-nums text-fg/70">
                    {signed(row.pointDiff)}
                  </td>
                  <td className="hidden px-1 py-2.5 text-center tabular-nums text-fg/55 sm:table-cell">
                    {row.pointsFor}
                  </td>
                  <td className="hidden px-1 py-2.5 text-center tabular-nums text-fg/55 sm:table-cell">
                    {row.pointsAgainst}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The tournament's headline numbers, as a row of small tiles. */
export function SummaryStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="liquid-glass-panel rounded-2xl px-3 py-3.5 text-center">
          <div className="text-xl font-semibold tabular-nums text-fg sm:text-2xl">{item.value}</div>
          <div className="mt-1 text-[11px] leading-tight text-fg/70">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
