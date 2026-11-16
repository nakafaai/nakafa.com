import type { AwardSource, Tally } from "@repo/backend/confect/island/schema";
import { Array as Arr, Match, Option, pipe, Record } from "effect";

type Counts = typeof Tally.Type;

/** The counts that reach the tiers of one power of ten: 1, 2 and 5 times it. */
const STEPS = [1, 2, 5] as const;

/**
 * The count that reaches a tier, from tier 1 (ADR 0047, D30): 1, 2, 5, 10, 20,
 * 50, 100 and on without end, so the first lesson already earns a badge and
 * the next tier is never out of sight.
 */
export function markOf(tier: number) {
  const index = tier - 1;
  return (
    Arr.getUnsafe(STEPS, index % STEPS.length) *
    10 ** Math.floor(index / STEPS.length)
  );
}

/** The tier a count reaches, counted up from the one given. */
function climbed(count: number, tier: number): number {
  return markOf(tier + 1) <= count ? climbed(count, tier + 1) : tier;
}

/** The tier a count has reached: 0 before the first, and no last one. */
export function tierOf(count: number) {
  return climbed(count, 0);
}

/** How often a name was counted, 0 when it never was. */
function countOf(counts: Record<string, number>, name: string) {
  return Option.getOrElse(Record.get(counts, name), () => 0);
}

/**
 * Every count of a tally by the name of its badge: the five kinds of learning,
 * then each subject by its material domain.
 */
export function countsOf(tally: Counts): Record<string, number> {
  return {
    days: tally.days,
    lessons: tally.lessons,
    sections: tally.sections,
    sets: tally.sets,
    streak: tally.streak,
    ...tally.subjects,
  };
}

/** A tally with what one kind of learning adds to it. */
const counted = Match.type<AwardSource>().pipe(
  Match.tagsExhaustive({
    lesson: (source) => (tally: Counts) => ({
      ...tally,
      lessons: tally.lessons + 1,
      subjects: {
        ...tally.subjects,
        [source.subject]: countOf(tally.subjects, source.subject) + 1,
      },
    }),
    section: () => (tally: Counts) => ({
      ...tally,
      sections: tally.sections + 1,
    }),
    set: () => (tally: Counts) => ({ ...tally, sets: tally.sets + 1 }),
  })
);

/**
 * The tally after one grant: its kind of learning counted, a day more when it
 * is the day's first grant, and the longest run of days kept.
 */
export function tallyAfter(
  tally: Counts,
  source: AwardSource,
  firstOfDay: boolean,
  streak: number
): Counts {
  return {
    ...counted(source)(tally),
    days: tally.days + (firstOfDay ? 1 : 0),
    streak: Math.max(tally.streak, streak),
  };
}

/** The badge tiers a tally reached that the one before it had not. */
export function reachedBadges(before: Counts, after: Counts) {
  const was = countsOf(before);
  return pipe(
    Record.toEntries(countsOf(after)),
    Arr.map(([name, count]) => ({
      from: tierOf(countOf(was, name)),
      name,
      tier: tierOf(count),
    })),
    Arr.filter((badge) => badge.tier > badge.from),
    Arr.map(({ name, tier }) => ({ name, tier }))
  );
}
