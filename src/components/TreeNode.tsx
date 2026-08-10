import type { Match, Player } from "@/lib/supabase/types";
import { MatchCard } from "@/components/MatchCard";
import type { Dict } from "@/lib/i18n/dictionary";

export function TreeNode({
  match,
  childrenMap,
  players,
  t,
  locale,
}: {
  match: Match;
  childrenMap: Map<string, Match[]>;
  players: Player[];
  t: Dict;
  locale: string;
}) {
  const children = (childrenMap.get(match.id) ?? []).sort(
    (a, b) => (a.next_match_slot ?? 0) - (b.next_match_slot ?? 0)
  );

  return (
    <div className="flex items-stretch">
      {children.length > 0 && (
        <>
          {/* Each child gets an equal-height row, so with two children their
              centres land at exactly 25% and 75% of this column's height. */}
          <div className="flex flex-col self-stretch">
            {children.map((c) => (
              <div key={c.id} className="flex flex-1 items-center py-2">
                <TreeNode match={c} childrenMap={childrenMap} players={players} t={t} locale={locale} />
                <span className="h-px w-5 shrink-0 bg-line/30" aria-hidden />
              </div>
            ))}
          </div>
          {/* The bracket elbow: a vertical spine spanning child centres, plus a
              stub running out to the parent card. */}
          <div className="relative w-5 shrink-0 self-stretch" aria-hidden>
            <span className="absolute inset-y-1/4 start-0 w-px bg-line/30" />
            <span className="absolute top-1/2 start-0 h-px w-full bg-line/30" />
          </div>
        </>
      )}
      <div className="flex w-[17.5rem] shrink-0 items-center sm:w-[20rem]">
        <MatchCard match={match} players={players} t={t} locale={locale} />
      </div>
    </div>
  );
}
