import { countsOf, markOf, tierOf } from "@repo/backend/confect/island/badge";
import type { Tally } from "@repo/backend/confect/island/schema";
import type { Week } from "@repo/backend/confect/island/view";
import { MedalSchema } from "@repo/mascot/medal/name";
import { Array as Arr, Option, Order, pipe, Record } from "effect";
import type { entryOf } from "@/lib/island/entry";

/** How far a learner is between the level they reached and the next one: the share done, and the Stars still to earn. */
export function levelProgress(
  island: Pick<ReturnType<typeof entryOf>, "from" | "lifetime" | "next">
) {
  return {
    left: island.next - island.lifetime,
    share: (island.lifetime - island.from) / (island.next - island.from),
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
 * Every medal of a tally, as a profile shows them all (ADR 0047, D30), the
 * earned ones before those still to earn: its count, the tier it reached, the
 * count of the next tier, and the share of the way there.
 */
export function medalsOf(tally: typeof Tally.Type) {
  const counts = countsOf(tally);
  const medals = Arr.map(MedalSchema.literals, (name) => {
    const count = Option.getOrElse(Record.get(counts, name), () => 0);
    const tier = tierOf(count);
    const from = tier === 0 ? 0 : markOf(tier);
    const next = markOf(tier + 1);
    return { count, name, next, share: (count - from) / (next - from), tier };
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
