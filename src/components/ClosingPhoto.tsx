/**
 * The group photo from finals night. It only belongs on the page once the
 * tournament is actually over, so the home page gates it on the champion
 * being set rather than the component hiding itself.
 */
export function ClosingPhoto({
  title,
  caption,
  alt,
}: {
  title: string;
  caption: string;
  alt: string;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-12 sm:pt-16">
      <figure className="liquid-glass-panel glass-champion rounded-3xl">
        {/* The frame is 4:3, so the phone gets the whole photo; wider than that
            the card goes 16:9 and the crop comes off the empty top of the wall,
            anchored to the bottom so nobody loses their head to it. The aspect
            ratio also reserves the height up front, so the caption doesn't jump
            while the photo is still coming down the wire. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/team-photo.jpg"
          alt={alt}
          width={1560}
          height={1170}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover object-bottom sm:aspect-[16/9]"
        />
        <figcaption className="px-5 py-5 text-center sm:px-8 sm:py-6">
          <p className="text-xs uppercase tracking-widest text-fg/70">{title}</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-fg/70">{caption}</p>
        </figcaption>
      </figure>
    </section>
  );
}
