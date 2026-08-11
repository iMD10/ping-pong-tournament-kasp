"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A folded shelf for the part of a list that isn't the headline — results
 * already played, mostly. It stays shut until asked, unless there is nothing
 * above it to look at, in which case it opens itself. Once the reader has
 * touched it, their choice sticks: `defaultOpen` only speaks while they
 * haven't. */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const open = picked ?? defaultOpen;

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setPicked(!open)}
        aria-expanded={open}
        className="liquid-glass flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm text-fg/70 transition-colors hover:text-fg"
      >
        <span className="flex items-center gap-2 font-medium">
          {title}
          {count != null && (
            <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[11px] tabular-nums text-fg/70">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && children}
    </section>
  );
}
