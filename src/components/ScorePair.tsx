/**
 * A score pair — 11-7 — laid out as a row instead of written as one string.
 *
 * Player one is drawn at the start of every match row: the right-hand side in
 * Arabic, the left in English. A written "11-7" cannot follow that, because the
 * bidi algorithm reads digit-hyphen-digit as a single number and renders it
 * left-to-right whichever way the page runs — so in Arabic the winner's 11 ends
 * up sitting over the loser's name. Two spans in a flex row are placed by the
 * layout instead, which puts each number on its own player's side in both
 * languages.
 */
export function ScorePair({
  score1,
  score2,
  className = "",
}: {
  score1: number;
  score2: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${className}`}>
      <span>{score1}</span>
      <span className="text-fg/45">-</span>
      <span>{score2}</span>
    </span>
  );
}
