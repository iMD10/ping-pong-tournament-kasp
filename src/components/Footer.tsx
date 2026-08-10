"use client";

import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n/dictionary";

const PORTFOLIO_URL = "https://www.mohanadalfawzan.me/";

export function Footer({ footer, brand }: { footer: Dict["footer"]; brand: string }) {
  const pathname = usePathname();

  // Same rule as the navbar: the admin dashboard carries no marketing chrome.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-fg/10 bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-10 text-center sm:flex-row sm:justify-between sm:gap-8 sm:px-8 sm:text-start">
        {/* The logo is a JPG with a white matte, so it only sits cleanly on a
            white surface — hence bg-surface on the footer rather than bg-bg. */}
        <img
          src="/kaust-logo.jpg"
          alt={footer.org}
          className="h-16 w-auto shrink-0 object-contain sm:h-20"
        />
        <div className="sm:text-end">
          <p className="text-sm font-semibold text-fg">{brand}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-fg/70">{footer.credit}</p>
          <p className="mt-1 text-xs font-medium text-accent">{footer.sponsors}</p>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] text-fg/70 underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            {footer.builtBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
