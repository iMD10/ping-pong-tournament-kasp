"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { addStatement, removeStatement } from "@/lib/actions";
import type { Player, Statement } from "@/lib/supabase/types";

/** Sentinel for the "not a registered player" option in the picker below. */
const CUSTOM = "__custom__";

/** Quotes that scroll across the hall of fame page and show up on a player's
 * profile. Picking a roster player links the statement to them; "غير لاعب"
 * keeps the name as free text, for spectators. */
export function StatementsPanel({
  statements,
  players,
}: {
  statements: Statement[];
  players: Player[];
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState(CUSTOM);
  const [name, setName] = useState("");
  const [quote, setQuote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectPlayer = (value: string) => {
    setPlayerId(value);
    if (value !== CUSTOM) {
      const p = players.find((p) => p.id === value);
      if (p) setName(p.name);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addStatement(name, quote, playerId === CUSTOM ? null : playerId);
      if (!res.ok) setError(res.error);
      else {
        setPlayerId(CUSTOM);
        setName("");
        setQuote("");
        router.refresh();
      }
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeStatement(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-medium text-fg">تصريحات اللاعبين</h2>
        <span className="text-sm tabular-nums text-fg/70">{statements.length}</span>
      </div>
      <p className="mb-4 text-xs text-fg/70">تمر شريط متحرك في صفحة الألقاب.</p>

      <form onSubmit={add} className="mb-4 flex flex-col gap-2.5">
        <select
          value={playerId}
          onChange={(e) => selectPlayer(e.target.value)}
          aria-label="اللاعب"
          className="rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg outline-none focus:bg-fg/[0.1]"
        >
          <option value={CUSTOM}>غير لاعب / اسم يدوي</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {playerId === CUSTOM && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              dir="auto"
              aria-describedby="statement-name-hint"
              aria-label="اسم صاحب التصريح"
              placeholder="الاسم، أي أحد"
              className="rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
            />
            <p id="statement-name-hint" className="-mt-1 text-xs text-fg/60">
              اكتب أي اسم تبيه، مو لازم يكون لاعب مسجّل. اختر لاعب من القائمة لو التصريح له.
            </p>
          </>
        )}
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          maxLength={200}
          rows={3}
          dir="auto"
          aria-label="التصريح"
          placeholder="التصريح… مثال: بجيب الكرتون كامل وما أعطي أحد"
          className="thin-scroll resize-y rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm leading-relaxed text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-fg/50">{quote.length}/200</span>
          <button
            disabled={pending || !name.trim() || !quote.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={15} />
            ضيف
          </button>
        </div>
      </form>

      {error && <p className="mb-3 text-xs text-live">{error}</p>}

      {statements.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg/70">ما به تصريحات بعد</p>
      ) : (
        <ul className="thin-scroll flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {statements.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl bg-fg/[0.05] px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p dir="auto" className="text-sm leading-relaxed text-fg/85">
                  {s.quote}
                </p>
                <p dir="auto" className="mt-0.5 text-xs text-fg/60">
                  —{" "}
                  {s.player_id ? (
                    <Link href={`/players/${s.player_id}`} className="hover:text-fg hover:underline">
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                </p>
              </div>
              <button
                onClick={() => remove(s.id)}
                aria-label={`حذف تصريح ${s.name}`}
                className="mt-0.5 shrink-0 text-fg/70 transition-colors hover:text-live"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
