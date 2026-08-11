import { buildBracket, nextPowerOfTwo, roundCodeForDistance, type Pairing } from "@/lib/bracket";
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
 * Checks that a hand-made split is a legal group stage for `playerIds`: enough
 * groups, nobody missing or doubled up, every group big enough to be a group,
 * and at least one player in each of them going home.
 */
export function validateGroupSplit(
  groups: string[][],
  playerIds: string[],
  advancePerGroup: number
): { valid: true } | { valid: false; error: string } {
  if (groups.length < 2) return { valid: false, error: "لازم مجموعتين على الأقل" };

  const smallest = Math.min(...groups.map((g) => g.length));
  if (smallest < MIN_GROUP_SIZE) {
    return { valid: false, error: `كل مجموعة لازم ${MIN_GROUP_SIZE} لاعبين على الأقل` };
  }
  if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1 || advancePerGroup >= smallest) {
    return { valid: false, error: `عدد المتأهلين لازم بين 1 و ${smallest - 1} من كل مجموعة` };
  }

  const roster = new Set(playerIds);
  const seen = new Set<string>();
  for (const id of groups.flat()) {
    if (!roster.has(id)) return { valid: false, error: "فيه لاعب مو مسجّل بالقائمة" };
    if (seen.has(id)) return { valid: false, error: "فيه لاعب محطوط بأكثر من مجموعة" };
    seen.add(id);
  }
  if (seen.size !== playerIds.length) {
    return { valid: false, error: `باقي ${playerIds.length - seen.size} لاعب بدون مجموعة` };
  }

  return { valid: true };
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

/** A win by this much or more is worth double and costs the loser a point. */
export const BIG_WIN_MARGIN = 6;

/**
 * What one group result is worth to each side, read off the margin: win by 6
 * or more and it's 2 for the winner and -1 for the loser; anything closer is 1
 * and nothing. A walkover has no margin to measure, so it pays the narrow win —
 * the loser gave the win away, they didn't get beaten by six.
 */
export function groupPointsForMargin(margin: number): { winner: number; loser: number } {
  return margin >= BIG_WIN_MARGIN ? { winner: 2, loser: -1 } : { winner: 1, loser: 0 };
}

export interface GroupStanding {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  /** Table points from the margin rule — what the group is ranked on. */
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

/**
 * Wins each player in `players` picked up in matches against each other —
 * not against the rest of the group. Used to break ties between players
 * level on wins: whoever won their head-to-head gets the edge.
 */
function headToHeadWins(players: string[], groupMatches: Match[]): Map<string, number> {
  const wins = new Map(players.map((id) => [id, 0]));
  const inTie = new Set(players);
  for (const m of groupMatches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    if (!inTie.has(m.player1_id) || !inTie.has(m.player2_id)) continue;
    const w = wins.get(m.winner_id);
    if (w != null) wins.set(m.winner_id, w + 1);
  }
  return wins;
}

/**
 * The table for one group.
 *
 * Ranking is table points first — 2 for a win by six or more, 1 for anything
 * closer, and -1 charged to whoever lost by six. Players level on points are
 * then split by their head-to-head record against each other (whoever won that
 * match ranks above), and only players still level after that fall back to
 * scored points — difference, then points scored. A walkover still counts as a
 * win and a loss; it just brings no scored points with it.
 */
export function computeStandings(members: string[], groupMatches: Match[]): GroupStanding[] {
  const table = new Map<string, GroupStanding>(
    members.map((id) => [
      id,
      {
        playerId: id,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      },
    ])
  );

  for (const m of groupMatches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
    const winner = table.get(m.winner_id);
    const loser = table.get(loserId);

    const scored = m.outcome_type === "score" && m.games.length > 0;
    const p1 = scored ? totalPointsFor(m.games, 1) : 0;
    const p2 = scored ? totalPointsFor(m.games, 2) : 0;
    const margin = scored ? Math.abs(p1 - p2) : 0;
    const award = groupPointsForMargin(margin);

    if (winner) {
      winner.played += 1;
      winner.wins += 1;
      winner.points += award.winner;
    }
    if (loser) {
      loser.played += 1;
      loser.losses += 1;
      loser.points += award.loser;
    }

    if (scored) {
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

  const byPoints = [...rows].sort((a, b) => b.points - a.points);
  const ranked: GroupStanding[] = [];
  for (let i = 0; i < byPoints.length; ) {
    let j = i + 1;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const tied = byPoints.slice(i, j);
    if (tied.length > 1) {
      const h2h = headToHeadWins(
        tied.map((row) => row.playerId),
        groupMatches
      );
      tied.sort(
        (a, b) =>
          h2h.get(b.playerId)! - h2h.get(a.playerId)! ||
          b.pointDiff - a.pointDiff ||
          b.pointsFor - a.pointsFor
      );
    }
    ranked.push(...tied);
    i = j;
  }
  return ranked;
}

/** True when two rows are level on everything the ranking looks at. */
export function isTiedWith(a: GroupStanding, b: GroupStanding): boolean {
  return (
    a.points === b.points &&
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

/** One place in a group table that a knockout slot is waiting on. */
export interface ProjectedSlot {
  groupNo: number;
  /** 0 = group winner, 1 = runner-up, … */
  place: number;
  /** Who is already standing there, once the group has stopped moving. */
  playerId: string | null;
}

/** A knockout match as it can be drawn before the qualifiers are known. */
export interface ProjectedMatch {
  id: string;
  round: Round;
  slot1: ProjectedSlot | null;
  slot2: ProjectedSlot | null;
  bye: boolean;
  nextId: string | null;
  nextSlot: 1 | 2 | null;
}

/**
 * The knockout tree the current groups are going to produce, drawn before it
 * exists.
 *
 * The seeding depends on the shape of the group stage, not on who wins it, so
 * running the real pipeline over placeholder qualifiers — "group 0, first
 * place" — lays out exactly the tree `buildKnockoutFromGroups` will insert,
 * with every slot labelled by the place that will fill it. Places in a group
 * that has finished carry their player along, so the tree fills in group by
 * group instead of all at once at the end.
 */
export function projectKnockout(groups: GroupView[], advancePerGroup: number): ProjectedMatch[] {
  if (groups.length === 0) return [];

  const qualifiers = groups.map((g) =>
    Array.from(
      { length: Math.min(advancePerGroup, g.standings.length) },
      (_, place) => `${g.groupNo}:${place}`
    )
  );
  if (qualifiers.reduce((sum, q) => sum + q.length, 0) < 2) return [];

  const byGroupNo = new Map(groups.map((g) => [g.groupNo, g]));
  const slotFor = (token: string | null): ProjectedSlot | null => {
    if (token == null) return null;
    const [groupNo, place] = token.split(":").map(Number);
    const group = byGroupNo.get(groupNo);
    return {
      groupNo,
      place,
      playerId: group?.complete ? group.standings[place]?.playerId ?? null : null,
    };
  };

  return buildBracket(knockoutPairingsFromQualifiers(qualifiers)).map((m, i) => ({
    id: `p${i}`,
    round: m.round,
    slot1: slotFor(m.player1Id),
    slot2: slotFor(m.player2Id),
    bye: m.outcomeType === "bye",
    nextId: m.nextIndex == null ? null : `p${m.nextIndex}`,
    nextSlot: m.nextSlot,
  }));
}

/** The knockout round `qualifierCount` players walk into (16 of them -> R16). */
export function entryRoundCode(qualifierCount: number): Round {
  const size = nextPowerOfTwo(Math.max(2, qualifierCount));
  const totalRounds = Math.log2(size);
  return roundCodeForDistance(totalRounds - 1, size / 2);
}
