"use client";

import { Quote } from "lucide-react";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { Statement } from "@/lib/supabase/types";

const TICKER_TABLES = ["statements", "tournament_state", "matches"];

/** Vertical marquee of admin-entered quotes, sitting on the hero. The list is
 * repeated an even number of times inside the track: the animation moves the
 * track up by half its height, so a copy lands exactly where the first started
 * and the loop never shows a seam.
 *
 * Styled for the dark hero, and deliberately without backdrop-blur: the window
 * is masked at both edges, and a mask clips its children's backdrop. */
export function StatementsTicker({ statements, title }: { statements: Statement[]; title: string }) {
  // Mounted even when there is nothing to show, so the hero picks up the first
  // statement the admin adds without anyone hitting reload.
  useLiveRefresh(TICKER_TABLES);

  if (statements.length === 0) return null;

  // The track has to be taller than twice the window or the loop shows a blank
  // stretch, so a short list gets repeated more times. Always an even number of
  // copies, so half the track is still a whole number of them.
  const copies = 2 * Math.max(1, Math.ceil(4 / statements.length));
  const perLoop = (statements.length * copies) / 2;
  // Slow enough to read a card before it climbs out of the window.
  const duration = Math.max(13, perLoop * 3);

  return (
    // Below xl it sits in the hero's flow, under the lede. From xl there is
    // room to pin it as its own column on the left, clear of the centred
    // headline and lede and of the players card in the bottom corner.
    <div
      className="mt-6 w-full max-w-lg text-start sm:mt-8 xl:absolute xl:left-6 xl:top-1/2 xl:mt-0 xl:w-72 xl:-translate-y-1/2 2xl:left-10 2xl:w-80"
    >
      <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-white/60">
        {title}
      </p>

      <div
        className="ticker ticker-fade thin-scroll h-36 overflow-hidden sm:h-44 xl:h-52"
        style={{ ["--ticker-duration" as string]: `${duration}s` }}
      >
        <ul className="ticker-track flex flex-col">
          {Array.from({ length: copies }, (_, copy) =>
            statements.map((s) => (
              <li
                key={`${copy}-${s.id}`}
                // The repeats are decoration; screen readers read the list once.
                aria-hidden={copy > 0 || undefined}
                // Spacing lives on the item, not as a flex gap: that keeps the
                // track exactly twice one copy's height, so the seam is exact.
                className="mb-3 flex items-start gap-3 rounded-2xl border border-white/25 bg-navy/70 px-4 py-3.5 sm:px-5 sm:py-4"
              >
                <Quote size={16} className="mt-1 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p dir="auto" className="text-[15px] leading-relaxed text-white sm:text-base">
                    {s.quote}
                  </p>
                  <p dir="auto" className="mt-1 text-sm text-white/65">
                    — {s.name}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
