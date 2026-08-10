import { cookies } from "next/headers";
import { getDict, type Lang } from "./dictionary";

/** Language lives in a cookie so server components render the right language. */
export function getLang(): Lang {
  return cookies().get("lang")?.value === "en" ? "en" : "ar";
}

export function getT() {
  return getDict(getLang());
}

export function dirFor(lang: Lang) {
  return lang === "ar" ? "rtl" : "ltr";
}
