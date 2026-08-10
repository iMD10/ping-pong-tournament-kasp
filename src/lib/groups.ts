import { nextPowerOfTwo, roundCodeForDistance, type Pairing } from "@/lib/bracket";
import { totalPointsFor } from "@/lib/match";
import type { Match, Round } from "@/lib/supabase/types";

/** A group any smaller than this is just a match with extra steps. */
export const MIN_GROUP_SIZE = 3;

/** Group labels: 0 -> A, 1 -> B, … (past Z it just keeps counting). */
export function groupLabel(groupNo: number): string {
  return groupNo < 26 ? String.fromCharCode(65 + groupNo) : String(groupNo + 1);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many players each group ends up with, biggest groups first. */
export function groupSizes(playerCount: number, groupCount: number): number[] {
  const base = Math.floor(playerCount / groupCount);
  const extra = playerCount % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Every group count that leaves at least MIN_GROUP_SIZE players in each group. */
export function possibleGroupCounts(playerCount: number): number[] {
  const max = Math.floor(playerCount / MIN_GROUP_SIZE);
  const counts: number[] = [];
  for (let g = 2; g <= max; g++) counts.push(g);
  return counts;
}

/** Spreads the roster at random across `groupCount` groups, dealing one at a time. */
export function distributeIntoGroups(playerIds: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  shuffle(playerIds).forEach((id, i) => groups[i % groupCount].push(id));
  return groups;
}

/**
 * Every pairing inside a group, ordered by the circle method so each matchday
 * has every player on a table at once instead of one player playing back to
 * back. An odd group sits one player out each round.
 */
export function roundRobinPairs(members: string[]): [string, string][] {
  if (members.length < 2) return [];

  const list: (string | null)[] = [...members];
  if (list.length % 2 === 1) list.push(null);
  const size = list.length;
  const half = size / 2;

  // The first player stays put and the rest rotate around them.
  const [fixed, ...rotating] = list;
  const out: [string, string][] = [];

  for (let r = 0; r < size - 1; r++) {
    const row = [fixed, ...rotating];
    for (let i = 0; i < half; i++) {
      const a = row[i];
      const b = row[size - 1 - i];
      if (a && b) out.push([a, b]);
    }
    rotating.unshift(rotating.pop()!);
  }

  return out;
}

export interface GroupStanding {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

/**
 * The table for one group.
 *
 * Ranking is wins first — nothing else — and points only break a tie, by
 * difference and then by points scored. A walkover still counts as a win and a
 * loss; it just brings no points with it.
 */
export function computeStandings(members: string[], groupMatches: Match[]): GroupStanding[] {
  const table = new Map<string, GroupStanding>(
    members.map((id) => [
      id,
      { playerId: id, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 },
    ])
  );

  for (const m of groupMatches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
    const winner = table.get(m.winner_id);
    const loser = table.get(loserId);
    if (winner) {
      winner.played += 1;
      winner.wins += 1;
    }
    if (loser) {
      loser.played += 1;
      loser.losses += 1;
    }

    if (m.outcome_type === "score" && m.games.length > 0) {
      const p1 = totalPointsFor(m.games, 1);
      const p2 = totalPointsFor(m.games, 2);
      const s1 = table.get(m.player1_id);
      const s2 = table.get(m.player2_id);
      if (s1) {
        s1.pointsFor += p1;
        s1.pointsAgainst += p2;
      }
      if (s2) {
        s2.pointsFor += p2;
        s2.pointsAgainst += p1;
      }
    }
  }

  const rows = [...table.values()];
  for (const row of rows) row.pointDiff = row.pointsFor - row.pointsAgainst;
  return rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.pointDiff - a.pointDiff ||
      b.pointsFor - a.pointsFor
  );
}

/** True when two rows are level on everything the ranking looks at. */
export function isTiedWith(a: GroupStanding, b: GroupStanding): boolean {
  return (
    a.wins === b.wins &&
    a.losses === b.losses &&
    a.pointDiff === b.pointDiff &&
    a.pointsFor === b.pointsFor
  );
}

export interface GroupView {
  groupNo: number;
  members: string[];
  matches: Match[];
  standings: GroupStanding[];
  /** Group matches with a result, out of all of them. */
  played: number;
  total: number;
  complete: boolean;
}

/**
 * Rebuilds the groups from the match rows themselves — the pairings are the
 * only record of who is in which group, and a full round robin puts every
 * member on at least one card.
 */
export function groupsFromMatches(matches: Match[]): GroupView[] {
  const byGroup = new Map<number, Match[]>();
  for (const m of matches) {
    if (m.round !== "G" || m.group_no == null) continue;
    const arr = byGroup.get(m.group_no) ?? [];
    arr.push(m);
    byGroup.set(m.group_no, arr);
  }

  return [...byGroup.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([groupNo, groupMatches]) => {
      const ordered = [...groupMatches].sort((a, b) => a.bracket_slot - b.bracket_slot);
      const members: string[] = [];
      for (const m of ordered) {
        for (const id of [m.player1_id, m.player2_id]) {
          if (id && !members.includes(id)) members.push(id);
        }
      }
      const played = ordered.filter((m) => !!m.winner_id).length;
      return {
        groupNo,
        members,
        matches: ordered,
        standings: computeStandings(members, ordered),
        played,
        total: ordered.length,
        complete: played === ordered.length,
      };
    });
}

/**
 * Standard bracket slot order for `size` seeds: seed 1 opens against the
 * lowest seed, and the top two can only meet in the final. Built by mirroring
 * each round onto the next ([1,2] -> [1,4,2,3] -> …).
 */
export function seedSlotOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const span = order.length * 2 + 1;
    const next: number[] = [];
    for (const seed of order) next.push(seed, span - seed);
    order = next;
  }
  return order;
}

/**
 * Seeds run tier by tier — every group winner, then every runner-up, and so on
 * — with each tier rotated `shift` places around the groups so a group's own
 * players don't land next to each other.
 */
function seedsForShift(qualifiersByGroup: string[][], shift: number): string[] {
  const groupCount = qualifiersByGroup.length;
  const tiers = Math.max(...qualifiersByGroup.map((q) => q.length));
  const seeds: string[] = [];
  for (let tier = 0; tier < tiers; tier++) {
    for (let i = 0; i < groupCount; i++) {
      const id = qualifiersByGroup[(i + tier * shift) % groupCount][tier];
      if (id) seeds.push(id);
    }
  }
  return seeds;
}

/** Seeds into first-round pairings; unfilled slots come back null (byes). */
function pairSeeds(seeds: string[]): Pairing[] {
  const size = nextPowerOfTwo(seeds.length);
  const order = seedSlotOrder(size);
  return Array.from({ length: size / 2 }, (_, i): Pairing => [
    seeds[order[i * 2] - 1] ?? null,
    seeds[order[i * 2 + 1] - 1] ?? null,
  ]);
}

/**
 * Turns each group's qualifiers into first-round knockout pairings.
 *
 * Two players out of the same group should not meet the moment the group stage
 * ends, and the further apart their halves of the tree, the better: rotating
 * the runners-up half a lap around the groups puts a winner and their own
 * runner-up in opposite halves. The rotation that does that depends on how the
 * qualifiers divide into the bracket, so rather than trust one formula this
 * walks the rotations down from half a lap and takes the first that actually
 * comes out clean.
 *
 * Fewer qualifiers than the bracket holds means the leftover slots come back
 * null, which `buildBracket` reads as byes for the strongest seeds.
 */
export function knockoutPairingsFromQualifiers(qualifiersByGroup: string[][]): Pairing[] {
  const groupCount = qualifiersByGroup.length;
  if (groupCount === 0) return [];

  const groupOf = new Map<string, number>();
  qualifiersByGroup.forEach((members, g) => members.forEach((id) => groupOf.set(id, g)));
  const clashes = (pairings: Pairing[]) =>
    pairings.some(([a, b]) => a != null && b != null && groupOf.get(a) === groupOf.get(b));

  const preferred = Math.floor(groupCount / 2);
  let fallback: Pairing[] | null = null;
  for (let shift = preferred; shift >= 0; shift--) {
    const pairings = pairSeeds(seedsForShift(qualifiersByGroup, shift));
    fallback ??= pairings;
    if (!clashes(pairings)) return pairings;
  }
  return fallback ?? [];
}

/** The knockout round `qualifierCount` players walk into (16 of them -> R16). */
export function entryRoundCode(qualifierCount: number): Round {
  const size = nextPowerOfTwo(Math.max(2, qualifierCount));
  const totalRounds = Math.log2(size);
  return roundCodeForDistance(totalRounds - 1, size / 2);
}
