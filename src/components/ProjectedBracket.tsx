import type { Player } from "@/lib/supabase/types";
import { groupLabel, type ProjectedMatch, type ProjectedSlot } from "@/lib/groups";
import { playerName } from "@/lib/players";
import type { Dict } from "@/lib/i18n/dictionary";

/** "Runner-up of Group B" — the seat, described by whoever is going to fill it. */
function slotLabel(slot: ProjectedSlot, t: Dict): string {
  const place = t.groups.places[slot.place] ?? `#${slot.place + 1}`;
  return t.groups.slotPattern.replace("{place}", place).replace("{group}", groupLabel(slot.groupNo));
}

function SlotRow({ slot, players, t }: { slot: ProjectedSlot | null; players: Player[]; t: Dict }) {
  const name = slot?.playerId ? playerName(players, slot.playerId) : "";

  return (
    <div className="flex items-center gap-3">
      {/* Keeps the rows lined up with a real MatchCard's winner tick column. */}
      <span className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm leading-7">
        {!slot ? (
          <span className="text-fg/45">{t.match.tbd}</span>
        ) : name ? (
          <>
            <span className="font-semibold text-fg">{name}</span>
            <span className="ms-2 text-[11px] text-fg/45">{slotLabel(slot, t)}</span>
          </>
        ) : (
          <span className="text-fg/70">{slotLabel(slot, t)}</span>
        )}
      </span>
    </div>
  );
}

function ProjectedCard({ match, players, t }: { match: ProjectedMatch; players: Player[]; t: Dict }) {
  return (
    <div className="liquid-glass-panel w-full rounded-2xl border border-dashed border-fg/15 p-4 opacity-90 sm:p-5">
      <div className="mb-3 truncate text-[12px] uppercase leading-6 tracking-wide text-fg/55">
        {t.rounds[match.round]}
      </div>

      <div className="flex flex-col gap-2">
        <SlotRow slot={match.slot1} players={players} t={t} />
        <SlotRow slot={match.slot2} players={players} t={t} />
      </div>

      {match.bye && <div className="mt-3 text-center text-xs text-fg/55">{t.match.bye}</div>}
    </div>
  );
}

/** Same geometry as `TreeNode`, over matches that have no rows behind them yet. */
function ProjectedNode({
  match,
  childrenMap,
  players,
  t,
}: {
  match: ProjectedMatch;
  childrenMap: Map<string, ProjectedMatch[]>;
  players: Player[];
  t: Dict;
}) {
  const children = (childrenMap.get(match.id) ?? []).sort(
    (a, b) => (a.nextSlot ?? 0) - (b.nextSlot ?? 0)
  );

  return (
    <div className="flex items-stretch">
      {children.length > 0 && (
        <>
          <div className="flex flex-col self-stretch">
            {children.map((c) => (
              <div key={c.id} className="flex flex-1 items-center py-2">
                <ProjectedNode match={c} childrenMap={childrenMap} players={players} t={t} />
                <span className="h-px w-5 shrink-0 bg-line/30" aria-hidden />
              </div>
            ))}
          </div>
          <div className="relative w-5 shrink-0 self-stretch" aria-hidden>
            <span className="absolute inset-y-1/4 start-0 w-px bg-line/30" />
            <span className="absolute top-1/2 start-0 h-px w-full bg-line/30" />
          </div>
        </>
      )}
      <div className="flex w-[17.5rem] shrink-0 items-center sm:w-[20rem]">
        <ProjectedCard match={match} players={players} t={t} />
      </div>
    </div>
  );
}

/**
 * The knockout tree as it will be, drawn while the groups are still deciding
 * who goes into it. Every card is a placeholder, so nothing here is live and
 * nothing is clickable — it only answers "where does the winner of Group A
 * come out?".
 */
export function ProjectedBracket({
  matches,
  players,
  t,
}: {
  matches: ProjectedMatch[];
  players: Player[];
  t: Dict;
}) {
  const root = matches.find((m) => m.nextId == null);
  if (!root) return null;

  const childrenMap = new Map<string, ProjectedMatch[]>();
  for (const m of matches) {
    if (!m.nextId) continue;
    const arr = childrenMap.get(m.nextId) ?? [];
    arr.push(m);
    childrenMap.set(m.nextId, arr);
  }

  return (
    <div className="thin-scroll -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full items-center justify-center p-1">
        <ProjectedNode match={root} childrenMap={childrenMap} players={players} t={t} />
      </div>
    </div>
  );
}
