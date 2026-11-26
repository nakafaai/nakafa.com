import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  reachedBadges,
  tallyAfter,
} from "@repo/backend/confect/progress/badge";
import { todayOf } from "@repo/backend/confect/progress/day";
import type { AwardSource } from "@repo/backend/confect/progress/schema";
import {
  AWARD_RULES,
  Capped,
  DAILY_STARS,
  DAY_GRANTS,
  Duplicate,
  Granted,
} from "@repo/backend/confect/progress/schema";
import { ensureProgress } from "@repo/backend/confect/progress/store";
import { streakAfter } from "@repo/backend/confect/progress/week";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Match, Option } from "effect";

/** The one key a source holds for good, so the same learning never grants twice. */
export const keyOf = Match.type<AwardSource>().pipe(
  Match.tagsExhaustive({
    lesson: (source) => `lesson:${source.content}`,
    section: (source) => `section:${source.set}:${source.section}`,
    set: (source) => `set:${source.set}`,
  })
);

/**
 * Grants the Stars of one piece of learning to its learner, in the caller's
 * transaction. A key already held grants nothing. A day whose count for the
 * kind, or whose 150 Stars, are reached grants nothing and writes nothing, so
 * the same learning can still earn on another day. Otherwise the grant writes
 * its ledger row with what remains of the day, at most the kind's Stars, raises
 * lifetime Stars, carries the learner's run of days on, and updates their tally,
 * returning the badge tiers newly reached.
 */
export const grantAward = Effect.fn("progress.grantAward")(function* (
  userId: Id<"users">,
  source: AwardSource
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const key = keyOf(source);
  const held = yield* database
    .table("progressAwards")
    .index("by_userId_and_key", (query) =>
      query.eq("userId", userId).eq("key", key)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(held)) {
    return Duplicate.make({});
  }
  const progress = yield* ensureProgress(userId);
  const day = yield* todayOf(progress.timeZone);
  const today = yield* database
    .table("progressAwards")
    .index("by_userId_and_day", (query) =>
      query.eq("userId", userId).eq("day", day)
    )
    .take(DAY_GRANTS)
    .pipe(Effect.orDie);
  const rule = AWARD_RULES[source._tag];
  const remaining =
    DAILY_STARS - Arr.reduce(today, 0, (total, row) => total + row.stars);
  const counted = Arr.countBy(today, (row) => row.kind === source._tag);
  if (remaining <= 0 || Option.exists(rule.daily, (most) => counted >= most)) {
    return Capped.make({});
  }
  const grant = {
    day,
    key,
    kind: source._tag,
    stars: Math.min(rule.stars, remaining),
    userId,
    ...(source._tag === "lesson" ? { subject: source.subject } : {}),
  };
  yield* writer.table("progressAwards").insert(grant).pipe(Effect.orDie);
  const streak = streakAfter(progress.learned, progress.streak ?? 0, day);
  const tally = tallyAfter(progress.tally, source, today.length === 0, streak);
  yield* writer
    .table("progress")
    .patch(progress._id, {
      learned: day,
      lifetime: progress.lifetime + grant.stars,
      streak,
      tally,
    })
    .pipe(Effect.orDie);
  return Granted.make({
    badges: reachedBadges(progress.tally, tally),
    stars: grant.stars,
  });
});
