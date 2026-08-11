"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Quote, Search } from "lucide-react";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { Statement } from "@/lib/supabase/types";
import type { Dict } from "@/lib/i18n/dictionary";

/** Full, searchable list of statements — newest first, filterable by name or
 * quote text. Names link to the player's profile when the admin linked one. */
export function StatementsBrowser({
  statements,
  t,
}: {
  statements: Statement[];
  t: Dict["statements"];
}) {
  useLiveRefresh(["statements"]);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...statements].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [statements]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => s.name.toLowerCase().includes(q) || s.quote.toLowerCase().includes(q));
  }, [sorted, query]);

  if (statements.length === 0) {
    return <p className="py-14 text-center text-sm text-fg/70">{t.empty}</p>;
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          dir="auto"
          placeholder={t.searchPlaceholder}
          className="w-full rounded-xl bg-fg/[0.06] py-2.5 pe-11 ps-4 text-sm text-fg placeholder-fg/40 outline-none focus:bg-fg/[0.1]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg/70">{t.noMatches}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s) => (
            <li key={s.id} className="liquid-glass-panel flex items-start gap-3 rounded-2xl px-4 py-3.5">
              <Quote size={16} className="mt-1 shrink-0 text-accent" />
              <div className="min-w-0">
                <p dir="auto" className="text-sm leading-relaxed text-fg/85">
                  {s.quote}
                </p>
                <p dir="auto" className="mt-1 text-xs text-fg/60">
                  —{" "}
                  {s.player_id ? (
                    <Link href={`/players/${s.player_id}`} className="text-accent hover:underline">
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
