"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Lang } from "@/lib/i18n/dictionary";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function LangToggle({ lang, className = "" }: { lang: Lang; className?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const toggle = () => {
    setCookie("lang", lang === "ar" ? "en" : "ar");
    startTransition(() => router.refresh());
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle language"
      className={`grid min-h-[46px] min-w-[46px] place-items-center rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20 ${className}`}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
