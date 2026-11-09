import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type AwardKind,
  DAY_GRANTS,
} from "@repo/backend/confect/island/schema";
import { dayBefore, STREAK_DAYS } from "@repo/backend/confect/island/week";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, DateTime, Effect, HashSet } from "effect";

/** The kinds of grant a try-out gives: a closed section, and a finished set. */
export const TRYOUT_KINDS: readonly (typeof AwardKind.Type)[] = [
  "section",
  "set",
];

/**
 * The days on which the learner closed a try-out section or finished a set,
 * from `STREAK_DAYS` days before `day` up to it, read from the ledger.
 */
export const tryoutDays = Effect.fn("island.run.tryoutDays")(function* (
  userId: Id<"users">,
  day: string
) {
  const database = yield* DatabaseReader;
  const from = DateTime.formatIsoDateUtc(
    DateTime.subtract(DateTime.makeUnsafe(`${day}T00:00:00Z`), {
      days: STREAK_DAYS,
    })
  );
  const rows = yield* Effect.forEach(TRYOUT_KINDS, (kind) =>
    database
      .table("islandAwards")
      .index("by_userId_and_kind_and_day", (query) =>
        query.eq("userId", userId).eq("kind", kind).gte("day", from)
      )
      .take(DAY_GRANTS * (STREAK_DAYS + 1))
      .pipe(Effect.orDie)
  );
  return HashSet.fromIterable(Arr.map(Arr.flatten(rows), (row) => row.day));
});

/** How many days in a row, back from `day` and at most `STREAK_DAYS`, hold a try-out. */
export function runBack(days: HashSet.HashSet<string>, day: string) {
  let run = 0;
  let at = day;
  while (run < STREAK_DAYS && HashSet.has(days, at)) {
    run += 1;
    at = dayBefore(at);
  }
  return run;
}

/** The try-out run as the learner sees it today: from today when they tried today, else still alive from yesterday. */
export function runOn(days: HashSet.HashSet<string>, today: string) {
  return HashSet.has(days, today)
    ? runBack(days, today)
    : runBack(days, dayBefore(today));
}
