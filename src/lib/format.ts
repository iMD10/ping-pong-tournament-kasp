/**
 * Presentation helpers for score pairs. Nothing here touches the rulebook or
 * the stored scores — a pair is only ever formatted on its way to the screen.
 */

/** LEFT-TO-RIGHT ISOLATE / POP DIRECTIONAL ISOLATE, spelled out so the source
 * doesn't carry two invisible characters. */
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

/**
 * Holds text in a left-to-right run, whichever direction it lands in.
 *
 * The site reads right-to-left in Arabic, and the bidi algorithm pulls a score
 * pair apart when it sits next to Arabic words: the digits are re-read as
 * Arabic numbers, the hyphen between them stays neutral and takes the
 * paragraph's right-to-left direction, and «11-7» is drawn on screen as
 * «7-11». The isolate pins the pair down wherever it is dropped, so the number
 * the reader sees first is the one that was written first.
 */
export function ltr(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/**
 * A score pair the way it is said out loud — the winner's number first, then
 * the loser's, held left to right: «11-7», never «7-11».
 *
 * The order is styling only. Who won is decided from the stored scores in
 * `match.ts`, and nothing reads a number back out of a formatted pair.
 */
export function scorePair(a: number, b: number): string {
  return ltr(a >= b ? `${a}-${b}` : `${b}-${a}`);
}
