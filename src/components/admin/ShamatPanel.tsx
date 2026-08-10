"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setBestShamat } from "@/lib/actions";
import type { TournamentState } from "@/lib/supabase/types";

/** «أفضل شمات» is the one award nothing computes: the admin names the winner. */
export function ShamatPanel({ state }: { state: TournamentState | null }) {
  const router = useRouter();
  const [name, setName] = useState(state?.best_shamat_name ?? "");
  const [quote, setQuote] = useState(state?.best_shamat_quote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await setBestShamat(name, quote);
      if (!res.ok) setError(res.error);
      else {
        setNote(name.trim() ? "انحفظ ✓" : "انشال اللقب");
        router.refresh();
      }
    });
  };

  const clear = () => {
    setName("");
    setQuote("");
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await setBestShamat("", "");
      if (!res.ok) setError(res.error);
      else {
        setNote("انشال اللقب");
        router.refresh();
      }
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <h2 className="font-medium text-fg">أفضل شمات</h2>
      <p className="mb-4 mt-1 text-xs text-fg/70">
        لقب المدرجات. تحدده بنفسك، ما يطلع من النتائج.
      </p>

      <form onSubmit={save} className="flex flex-col gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          dir="auto"
          aria-label="اسم الشامت"
          placeholder="اسم الشامت"
          className="rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
        />
        <input
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          maxLength={200}
          dir="auto"
          aria-label="الشماتة"
          placeholder="الشماتة نفسها (اختياري)"
          className="rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
        />
        <div className="flex items-center gap-2">
          <button
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <Check size={15} />
            احفظ
          </button>
          {(state?.best_shamat_name || name || quote) && (
            <button
              type="button"
              disabled={pending}
              onClick={clear}
              className="liquid-glass rounded-xl px-4 py-2.5 text-sm text-fg/70 transition-colors hover:text-live"
            >
              شيله
            </button>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-xs text-live">{error}</p>}
      {note && <p className="mt-3 text-xs text-accent">{note}</p>}
    </div>
  );
}
