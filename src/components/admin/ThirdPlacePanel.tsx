"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createThirdPlaceMatch } from "@/lib/actions";

/**
 * The catch-up button for a bracket drawn before the third-place match existed.
 * Every new draw with semifinals in it gets the fixture automatically, so this
 * panel only shows when the tree has semifinals and no bronze match — once it's
 * created, the match joins the board below like any other.
 */
export function ThirdPlacePanel() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await createThirdPlaceMatch();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <h2 className="font-medium text-fg">مباراة المركز الثالث</h2>
      <p className="mb-4 mt-1 text-xs text-fg/70">
        بين خاسري نصف النهائي، أفضل من خمسة أشواط. اللاعبين ينزلون مكانهم أول ما ينتهي نصف
        النهائي، وتنحسب بالإحصائيات مثل أي مباراة.
      </p>
      <button
        disabled={pending}
        onClick={create}
        className="rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
      >
        أضف المباراة
      </button>
      {error && <p className="mt-2 text-xs text-live">{error}</p>}
    </div>
  );
}
