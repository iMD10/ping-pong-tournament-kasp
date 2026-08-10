"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addPlayer, removePlayer } from "@/lib/actions";
import type { Player } from "@/lib/supabase/types";

export function PlayerManager({ players, locked }: { players: Player[]; locked: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addPlayer(name);
      if (!res.ok) setError(res.error);
      else {
        setName("");
        router.refresh();
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await removePlayer(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium text-fg">اللاعبون</h2>
        <span className="text-sm tabular-nums text-fg/70">{players.length}</span>
      </div>

      {locked ? (
        <p className="mb-3 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
          القرعة انسحبت، التسجيل مقفل.
        </p>
      ) : (
        <form onSubmit={add} className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم اللاعب"
            className="flex-1 rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
          />
          <button
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} />
            ضيف
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-xs text-live">{error}</p>}

      {players.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg/70">ما فيه لاعبين بعد</p>
      ) : (
        <ul className="thin-scroll flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-fg/[0.05] px-3.5 py-2.5 text-sm text-fg/85"
            >
              <span>{p.name}</span>
              {!locked && (
                <button
                  onClick={() => remove(p.id)}
                  aria-label={`حذف ${p.name}`}
                  className="text-fg/70 transition-colors hover:text-live"
                >
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
