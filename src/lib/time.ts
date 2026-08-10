/**
 * Match times are tournament-local, not device-local.
 *
 * `scheduled_at` is stored as a UTC instant, but the admin types a wall-clock
 * time ("4:30 pm") meaning the clock on the wall of the hall — and every
 * spectator reads it the same way. Left to the runtime's own zone, that same
 * instant renders as 4:30 pm on the admin's phone and 1:30 pm on the server-
 * rendered page (Vercel runs in UTC), which is exactly the mismatch this
 * module exists to remove: everything below pins the conversion to
 * TOURNAMENT_TIME_ZONE in both directions.
 */

export const TOURNAMENT_TIME_ZONE = "Asia/Riyadh";

/** Reads the wall-clock parts of an instant inside a zone. */
function zonedParts(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Zone offset in ms at a given instant (positive east of UTC). */
function zoneOffset(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") for an instant,
 * written in tournament time so the box shows the hour that was typed in.
 */
export function toScheduleInputValue(iso: string | null): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const p = zonedParts(ts, TOURNAMENT_TIME_ZONE);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The reverse: a datetime-local value read as tournament wall-clock time,
 * returned as a UTC instant. Returns null for an empty or unparsable box.
 */
export function scheduleInputToISO(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);

  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes: the first offset is read at the wrong instant when the typed
  // time sits near a DST switch, the second lands on the right side of it.
  let ts = guess - zoneOffset(guess, TOURNAMENT_TIME_ZONE);
  ts = guess - zoneOffset(ts, TOURNAMENT_TIME_ZONE);
  return new Date(ts).toISOString();
}

/** Match date + time for display, always on the tournament's clock. */
export function formatMatchTime(iso: string, locale: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: TOURNAMENT_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ts));
}
