import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { KleejaIcon } from "@/components/KleejaIcon";

export default function NotFound() {
  const t = getT();
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-5 text-center">
      <div className="animate-float-ball mb-6">
        <KleejaIcon className="h-16 w-16" />
      </div>
      <h1 className="text-2xl font-medium tracking-tight text-fg">{t.notFound.title}</h1>
      <p className="mt-3 text-sm text-fg/70">{t.notFound.lede}</p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-fg px-6 py-3.5 text-sm font-medium text-bg transition-all hover:opacity-90 active:scale-[0.97]"
      >
        {t.notFound.cta}
      </Link>
    </main>
  );
}
