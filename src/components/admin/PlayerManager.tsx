"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ClipboardList } from "lucide-react";
import { addPlayer, addPlayers, removePlayer } from "@/lib/actions";
import type { Player } from "@/lib/supabase/types";

/** Splits a pasted roster on newlines/commas and strips list bullets or numbering. */
function parseNames(text: string): string[] {
  return text
    .split(/[\n,،;]+/)
    .map((line) => line.replace(/^\s*(?:\d+\s*[.)\-–]|[-–•*])\s*/, "").trim())
    .filter(Boolean);
}

export function PlayerManager({ players, locked }: { players: Player[]; locked: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const parsed = parseNames(bulkText);

  const addMany = () => {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await addPlayers(parsed);
      if (!res.ok) setError(res.error);
      else {
        setBulkText("");
        setBulkOpen(false);
        setNote(
          res.data.skipped > 0
            ? `انضاف ${res.data.added}، وتخطّينا ${res.data.skipped} مكرر`
            : `انضاف ${res.data.added} لاعب`
        );
        router.refresh();
      }
    });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
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
        <div className="mb-4 flex flex-col gap-2.5">
          <form onSubmit={add} className="flex gap-2">
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

          <button
            onClick={() => {
              setBulkOpen((v) => !v);
              setError(null);
            }}
            className={`flex w-fit items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition-colors ${
              bulkOpen ? "bg-fg/[0.14] text-fg" : "liquid-glass text-fg/70 hover:text-fg"
            }`}
          >
            <ClipboardList size={13} />
            الصق قائمة أسماء
          </button>

          {bulkOpen && (
            <div className="flex flex-col gap-2 rounded-xl bg-fg/[0.05] p-3">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                dir="auto"
                placeholder={"اسم بكل سطر، أو مفصولين بفاصلة\nمحمد\nعبدالله\nسلمان"}
                className="thin-scroll w-full resize-y rounded-lg bg-fg/[0.06] px-3 py-2.5 text-sm leading-relaxed text-fg placeholder-fg/30 outline-none focus:bg-fg/[0.1]"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-fg/70">
                  {parsed.length > 0 ? `${parsed.length} اسم جاهز` : "الأرقام والشرطات تنشال تلقائي"}
                </span>
                <button
                  disabled={pending || parsed.length === 0}
                  onClick={addMany}
                  className="flex items-center gap-1.5 rounded-full bg-fg px-4 py-2 text-xs font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
                >
                  <Plus size={13} />
                  ضيفهم كلهم
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-3 text-xs text-live">{error}</p>}
      {note && <p className="mb-3 text-xs text-accent">{note}</p>}

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
