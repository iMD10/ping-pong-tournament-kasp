"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { buildSkeleton, seatArray, type SkeletonMatch } from "@/lib/draw";
import { playerName } from "@/lib/players";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { DrawSlot, Player } from "@/lib/supabase/types";
import type { Dict } from "@/lib/i18n/dictionary";

const DRAW_TABLES = ["draw_slots", "tournament_state"];
/** How long a freshly drawn name spins before it settles. */
const ROLL_MS = 1200;

export function DrawCeremony({
  players,
  slots,
  size,
  done,
  t,
}: {
  players: Player[];
  slots: DrawSlot[];
  size: number;
  done: boolean;
  t: Dict;
}) {
  useLiveRefresh(DRAW_TABLES);

  const skeleton = useMemo(() => buildSkeleton(size), [size]);
  const seats = useMemo(() => seatArray(slots, size), [slots, size]);
  const rolling = useRollingSeat(slots);

  const placed = new Set(slots.map((s) => s.player_id));
  const inBag = players.filter((p) => !placed.has(p.id));

  const childrenMap = useMemo(() => {
    const map = new Map<string, SkeletonMatch[]>();
    for (const m of skeleton) {
      if (!m.nextKey) continue;
      const arr = map.get(m.nextKey) ?? [];
      arr.push(m);
      map.set(m.nextKey, arr);
    }
    return map;
  }, [skeleton]);

  const final = skeleton[skeleton.length - 1];
  if (!final) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-live/15 px-4 py-2 text-sm font-medium text-live">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
          </span>
          {done ? t.draw.done : t.draw.onAir}
        </span>
        <span className="text-sm tabular-nums text-fg/70">
          {t.draw.progress} <span className="font-medium text-fg">{slots.length}</span> {t.draw.of}{" "}
          <span className="font-medium text-fg">{players.length}</span>
        </span>
      </div>

      <div className="thin-scroll -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full items-center justify-center gap-5 p-1">
          <DrawNode
            match={final}
            childrenMap={childrenMap}
            seats={seats}
            players={players}
            rolling={rolling}
            t={t}
          />
          <span className="h-px w-5 shrink-0 bg-line/30" aria-hidden />
          <div className="liquid-glass-panel flex w-[9rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-4 py-5 text-center">
            <Trophy size={20} className="text-accent/50" />
            <span className="text-[12px] uppercase tracking-wide text-fg/55">{t.home.championTitle}</span>
          </div>
        </div>
      </div>

      <div className="liquid-glass-panel rounded-2xl p-5">
        <p className="mb-3 text-sm text-fg/70">
          {t.draw.inBag} <span className="tabular-nums">({inBag.length})</span>
        </p>
        {inBag.length === 0 ? (
          <p className="text-sm text-accent">{done ? t.draw.done : t.draw.bagEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inBag.map((p) => (
              <motion.span
                key={p.id}
                layout
                className="rounded-full bg-fg/[0.08] px-3.5 py-2 text-sm text-fg/85"
              >
                {p.name}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      {done && (
        <div className="text-center">
          <Link
            href="/bracket"
            className="inline-block rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            {t.draw.goBracket}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * The seat that just landed, for as long as its roulette runs. Seats already on
 * screen at first paint never roll — a spectator opening the page mid-draw
 * shouldn't watch ten names spin at once.
 */
function useRollingSeat(slots: DrawSlot[]): number | null {
  const seenRef = useRef<Set<number> | null>(null);
  const [rolling, setRolling] = useState<number | null>(null);

  useEffect(() => {
    const filled = new Set(slots.map((s) => s.seat));
    const seen = seenRef.current;
    seenRef.current = filled;
    if (seen === null) return;

    const fresh = [...filled].filter((s) => !seen.has(s));
    if (fresh.length !== 1) return;

    setRolling(fresh[0]);
    const id = setTimeout(() => setRolling(null), ROLL_MS);
    return () => clearTimeout(id);
  }, [slots]);

  return rolling;
}

function DrawNode({
  match,
  childrenMap,
  seats,
  players,
  rolling,
  t,
}: {
  match: SkeletonMatch;
  childrenMap: Map<string, SkeletonMatch[]>;
  seats: (string | null)[];
  players: Player[];
  rolling: number | null;
  t: Dict;
}) {
  const children = (childrenMap.get(match.key) ?? []).sort((a, b) => a.bracketSlot - b.bracketSlot);

  return (
    <div className="flex items-stretch">
      {children.length > 0 && (
        <>
          <div className="flex flex-col self-stretch">
            {children.map((c) => (
              <div key={c.key} className="flex flex-1 items-center py-2">
                <DrawNode
                  match={c}
                  childrenMap={childrenMap}
                  seats={seats}
                  players={players}
                  rolling={rolling}
                  t={t}
                />
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

      <div className={`flex shrink-0 items-center ${match.seats ? "w-[14rem]" : "w-[9.5rem]"}`}>
        {match.seats ? (
          <div className="liquid-glass-panel w-full rounded-2xl p-3.5">
            <p className="mb-2.5 text-[12px] text-fg/55">
              {t.draw.match} {match.bracketSlot + 1}
            </p>
            <div className="flex flex-col gap-1.5">
              <Seat
                playerId={seats[match.seats[0]]}
                players={players}
                rolling={rolling === match.seats[0]}
              />
              <span className="ps-1 text-[11px] text-fg/40">{t.match.vs}</span>
              <Seat
                playerId={seats[match.seats[1]]}
                players={players}
                rolling={rolling === match.seats[1]}
              />
            </div>
          </div>
        ) : (
          <div className="liquid-glass-panel flex w-full items-center justify-center rounded-2xl px-3 py-5">
            <span className="text-sm text-fg/35">{t.rounds[match.round]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Seat({
  playerId,
  players,
  rolling,
}: {
  playerId: string | null;
  players: Player[];
  rolling: boolean;
}) {
  if (rolling) return <Roulette players={players} />;

  if (!playerId) {
    return (
      <span className="rounded-lg border border-dashed border-fg/15 px-3 py-2 text-sm text-fg/30">
        —
      </span>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="truncate rounded-lg bg-fg/[0.09] px-3 py-2 text-sm font-medium text-fg"
    >
      {playerName(players, playerId)}
    </motion.span>
  );
}

/** Cycles the roster while a newly drawn name settles. */
function Roulette({ players }: { players: Player[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => v + 1), 70);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="truncate rounded-lg bg-accent/15 px-3 py-2 text-sm font-medium text-accent">
      {players.length > 0 ? players[i % players.length].name : "…"}
    </span>
  );
}
