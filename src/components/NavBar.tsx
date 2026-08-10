"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LangToggle } from "@/components/Controls";
import type { Dict, Lang } from "@/lib/i18n/dictionary";

export function NavBar({ lang, nav, brand }: { lang: Lang; nav: Dict["nav"]; brand: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // The admin dashboard is a working surface, not a public page, no marketing chrome.
  if (pathname?.startsWith("/admin")) return null;

  const links = [
    { href: "/", label: nav.home },
    { href: "/bracket", label: nav.bracket },
    { href: "/players", label: nav.players },
    { href: "/rules", label: nav.rules },
    { href: "/prize", label: nav.prize },
    { href: "/hall", label: nav.hall },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <>
      {/* Always an opaque navy field, light-on-dark, so it stays legible over
          any content behind it (hero video, masthead, or bare page). */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-navy px-4 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold text-white">
          <Image
            src="/klija.png"
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="tracking-tight">{brand}</span>
        </Link>

        {/* The bar always sits over a dark surface — the hero video on the home
            page, the navy masthead everywhere else — so it stays light-on-dark. */}
        <nav className="hidden items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2 py-2 backdrop-blur-md lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(l.href)
                  ? "font-semibold text-white after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:rounded-full after:bg-accent"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LangToggle lang={lang} />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LangToggle lang={lang} />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="grid h-[46px] w-[46px] place-items-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <div className="liquid-glass-panel !absolute inset-x-4 top-full z-40 mt-2 flex flex-col gap-1 rounded-2xl p-3 lg:hidden">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`w-full rounded-xl px-4 py-3.5 text-sm transition-colors [-webkit-tap-highlight-color:transparent] ${
                  isActive(l.href) ? "bg-fg/10 font-medium text-fg" : "text-fg/70 active:bg-fg/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>
    </>
  );
}
