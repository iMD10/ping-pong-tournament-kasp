import Link from "next/link";
import { LayoutList, Network, Users } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionary";

export type StageView = "groups" | "tree" | "matches";

/** The one control shared by /bracket and /matches. Every segment is a real
 * link, so a view can be shared, bookmarked and reached with the back button —
 * the match list used to live in component state, which meant nothing outside
 * the page could point at it. */
export function ViewSwitcher({
  active,
  hasGroups,
  t,
}: {
  active: StageView;
  hasGroups: boolean;
  t: Dict;
}) {
  const segments = [
    ...(hasGroups
      ? [{ key: "groups" as const, href: "/bracket?view=groups", label: t.groups.tab, Icon: Users }]
      : []),
    { key: "tree" as const, href: "/bracket?view=tree", label: t.bracket.tree, Icon: Network },
    { key: "matches" as const, href: "/matches", label: t.nav.matches, Icon: LayoutList },
  ];

  return (
    // Scrolls rather than clips: three segments with icons overflow a phone in
    // Arabic, and a centred row with no scroll silently slices the outer ones —
    // which is how the match list became unreachable. `min-w-full` on an
    // inline-flex keeps `justify-center` from eating the start edge once the
    // content is wider than the track.
    <div className="thin-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full justify-center">
        <div className="liquid-glass flex shrink-0 items-center gap-1 rounded-xl p-1.5">
          {segments.map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition-colors ${
                active === key ? "bg-fg/10 font-medium text-fg" : "text-fg/70 hover:text-fg"
              }`}
              aria-current={active === key ? "page" : undefined}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
