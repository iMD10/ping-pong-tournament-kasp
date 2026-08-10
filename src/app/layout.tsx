import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { dirFor, getLang, getT } from "@/lib/i18n/server";
import "./globals.css";

// Both fonts are self-hosted by next/font, no render-blocking request to
// fonts.googleapis.com, which was a chunk of the original load time.
// IBM Plex Sans Arabic covers 300-700 including a real 600, so `font-semibold`
// renders as designed instead of being matched up to 700.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-arabic",
});

// GeistSans.variable binds --font-geist-sans to "<Geist>, <Geist fallback>", and that
// fallback is local("Arial") with no unicode-range, so it matches Arabic too and the
// Arabic webfont further down the stack never gets reached. Bind the real family on its
// own; --font-arabic carries its own metric-adjusted fallback for the swap window.
const latinFamily = GeistSans.style.fontFamily.split(",")[0].trim();

export const metadata: Metadata = {
  title: "بطولة تنس الطاولة، KAUST Academy",
  description: "كرتون كليجا ينتظر بطل واحد فقط",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  const t = getT();

  return (
    <html
      lang={lang}
      dir={dirFor(lang)}
      className={`${GeistSans.variable} ${arabic.variable}`}
      style={{ "--font-latin": latinFamily } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans text-fg antialiased">
        <div className="ambient-bg" aria-hidden />
        <NavBar lang={lang} nav={t.nav} brand={t.brand} />
        {children}
        <Footer footer={t.footer} brand={t.brand} />
        <Analytics />
      </body>
    </html>
  );
}
