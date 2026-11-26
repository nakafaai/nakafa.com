import { countsOf, markOf, tierOf } from "@repo/backend/confect/progress/badge";
import { growthOf } from "@repo/backend/confect/progress/level";
import type { Tally } from "@repo/backend/confect/progress/schema";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import type { Growth, Week } from "@repo/backend/confect/progress/view";
import { weekOf } from "@repo/backend/confect/progress/week";
import { MedalSchema } from "@repo/mascot/medal/name";
import { Array as Arr, DateTime, Option, Order, pipe, Record } from "effect";

/**
 * The learner's progress summary derived from their growth record: their
 * current level, the Stars thresholds for this level and the next, their
 * lifetime Stars, and their tally for medals. A learner with no progress yet
 * starts at level 1 with zero Stars and an empty tally.
 */
export function progressSummary(growth: typeof Growth.Type | null | undefined) {
  const lifetime = growth?.lifetime ?? 0;
  const reached = growthOf(lifetime);
  return {
    from: reached.from,
    level: reached.level,
    lifetime,
    next: reached.next,
    tally: growth?.tally ?? EMPTY_TALLY,
  };
}

/** How far a learner is between the level they reached and the next one: the share done, and the Stars still to earn. */
export function levelProgress(
  growth: Pick<ReturnType<typeof progressSummary>, "from" | "lifetime" | "next">
) {
  return {
    left: growth.next - growth.lifetime,
    share: (growth.lifetime - growth.from) / (growth.next - growth.from),
  };
}

/** The medals every learner works toward from their first day: the five kinds of learning. */
const KINDS: readonly (typeof MedalSchema.Type)[] = [
  "days",
  "streak",
  "lessons",
  "sections",
  "sets",
];

/**
 * Every medal of a tally, as a profile shows them all, the earned ones before
 * those still to earn: its count, the tier it reached, the counts its tier
 * starts at and the next one does, and the share of the way there.
 */
export function medalsOf(tally: typeof Tally.Type) {
  const counts = countsOf(tally);
  const medals = Arr.map(MedalSchema.literals, (name) => {
    const count = Option.getOrElse(Record.get(counts, name), () => 0);
    const tier = tierOf(count);
    const from = tier === 0 ? 0 : markOf(tier);
    const next = markOf(tier + 1);
    return {
      count,
      from,
      name,
      next,
      share: (count - from) / (next - from),
      tier,
    };
  });
  return [
    ...Arr.filter(medals, (medal) => medal.tier > 0),
    ...Arr.filter(medals, (medal) => medal.tier === 0),
  ];
}

/**
 * The medals of a tally that the learner works on: the five kinds of learning
 * always, and each subject once they finished a lesson of it, so the wall
 * grows with what they explore.
 */
export function wallOf(tally: typeof Tally.Type) {
  return Arr.filter(
    medalsOf(tally),
    (medal) => medal.count > 0 || Arr.contains(KINDS, medal.name)
  );
}

/** The medals of a wall that stand highest, the highest tier first and the larger count first among equals. */
export function bestOf(wall: ReturnType<typeof wallOf>, most: number) {
  return pipe(
    wall,
    Arr.sortWith((medal) => -(medal.tier * 1e9 + medal.count), Order.Number),
    Arr.take(most)
  );
}

/** Seven empty days for the current UTC week, shown before the learner earns their first Star. */
export function emptyWeek(now: number) {
  const today = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now));
  return {
    days: Arr.map(weekOf(today), (day) => ({
      day,
      lessons: 0,
      sections: 0,
      sets: 0,
      stars: 0,
    })),
    today,
  };
}

/**
 * The learner's week as the tracker draws it: each day with how tall its bar
 * stands against the best day, whether it is today and whether it is still to
 * come, then the Stars of the whole week and whether today already counts.
 */
export function weekBars(days: (typeof Week.Type)["days"], today: string) {
  const best = Math.max(1, ...Arr.map(days, (day) => day.stars));
  return {
    bars: Arr.map(days, (day) => ({
      ahead: day.day > today,
      day: day.day,
      share: day.stars / best,
      stars: day.stars,
      today: day.day === today,
    })),
    learnedToday: Arr.some(days, (day) => day.day === today && day.stars > 0),
    stars: Arr.reduce(days, 0, (sum, day) => sum + day.stars),
  };
}
