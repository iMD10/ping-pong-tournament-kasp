/** Shown by each route's `loading.tsx` the moment a navigation starts, so a tap
 * always produces immediate feedback even while the server renders the page.
 * Mirrors PageShell's masthead so the swap to real content doesn't jump. */
export function PageSkeleton({ wide = false, rows = 4 }: { wide?: boolean; rows?: number }) {
  const width = wide ? "max-w-6xl" : "max-w-4xl";

  return (
    <>
      <section className="relative w-full overflow-hidden bg-navy pb-12 pt-28 sm:pb-16 sm:pt-32">
        <div className={`relative mx-auto animate-pulse px-4 sm:px-8 ${width}`}>
          <div className="mx-auto mb-4 h-6 w-24 rounded-full bg-white/10" />
          <div className="mx-auto h-8 w-48 rounded-lg bg-white/15 sm:h-10 sm:w-64" />
          <div className="mx-auto mt-4 h-4 w-64 rounded bg-white/10 sm:w-80" />
        </div>
      </section>

      <main className={`mx-auto px-4 pb-20 pt-10 sm:px-8 sm:pt-12 ${width}`}>
        <div className="grid animate-pulse gap-3 sm:grid-cols-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="liquid-glass-panel h-24 rounded-2xl" />
          ))}
        </div>
      </main>
    </>
  );
}
