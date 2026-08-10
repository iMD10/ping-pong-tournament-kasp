/** Home is a full-bleed hero rather than a masthead + list, so it gets its own
 * silhouette instead of the shared PageSkeleton. */
export default function Loading() {
  return (
    <section className="relative flex min-h-[100svh] w-full flex-col justify-center overflow-hidden bg-navy">
      <div className="relative z-20 flex w-full animate-pulse flex-col items-center px-6 py-24 text-center">
        <div className="mb-4 h-9 w-32 rounded-full bg-white/10" />
        <div className="h-10 w-64 rounded-lg bg-white/15 sm:h-16 sm:w-[28rem]" />
        <div className="mt-3 h-10 w-56 rounded-lg bg-white/15 sm:h-16 sm:w-96" />
        <div className="mt-6 h-4 w-72 rounded bg-white/10 sm:w-[26rem]" />
      </div>

      <div className="absolute bottom-28 left-4 z-20 h-28 w-[150px] animate-pulse rounded-[1.2rem] bg-white/10 md:bottom-6 md:left-6 md:rounded-[1.5rem] lg:bottom-10 lg:left-10 lg:w-[180px] lg:rounded-[2.2rem]" />
    </section>
  );
}
