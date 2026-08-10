import { KleejaIcon } from "@/components/KleejaIcon";

export function PageShell({
  title,
  subtitle,
  badge,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const width = wide ? "max-w-6xl" : "max-w-4xl";

  return (
    <>
      {/* Navy masthead, mirroring the KAUST Academy course pages. */}
      {/* min-height guarantees room for the bottom-anchored watermark to sit
          clear of the opaque navbar, even on title-only pages. */}
      <section className="relative flex min-h-[14rem] w-full flex-col justify-center overflow-hidden bg-navy pb-12 pt-28 sm:min-h-[17rem] sm:pb-16 sm:pt-32">
        <img
          src="/klija.png"
          alt=""
          aria-hidden="true"
          /* Anchored to the band's bottom, not centred: the navbar is opaque and
             sits on top, so a centred watermark gets sliced by it. */
          className="pointer-events-none absolute bottom-4 right-5 h-20 w-20 -rotate-12 object-contain opacity-[0.07] sm:bottom-7 sm:right-10 sm:h-32 sm:w-32"
        />
        <div className={`relative mx-auto px-4 text-center sm:px-8 ${width}`}>
          {badge && (
            <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-accent">
              {badge}
            </span>
          )}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">{subtitle}</p>
          )}
        </div>
      </section>

      <main className={`mx-auto px-4 pb-20 pt-10 sm:px-8 sm:pt-12 ${width}`}>{children}</main>
    </>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="liquid-glass-panel rounded-2xl px-6 py-14 text-center">
      <KleejaIcon className="animate-float-ball mx-auto mb-4 h-12 w-12 opacity-60" />
      <p className="text-sm text-fg/70">{children}</p>
    </div>
  );
}
