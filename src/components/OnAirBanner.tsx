import Link from "next/link";

/** Points the crowd at the draw page while the ceremony is on air. */
export function OnAirBanner({ title, cta }: { title: string; cta: string }) {
  return (
    <Link
      href="/draw"
      className="liquid-glass-panel group flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl px-6 py-8 text-center transition-colors hover:bg-fg/[0.06]"
    >
      <span className="inline-flex items-center gap-2 text-base font-medium text-fg">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
        </span>
        {title}
      </span>
      <span className="rounded-full bg-fg/[0.08] px-4 py-2 text-sm text-accent transition-colors group-hover:bg-fg/[0.14]">
        {cta}
      </span>
    </Link>
  );
}
