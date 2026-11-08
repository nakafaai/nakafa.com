import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { completedBadges } from "@repo/backend/confect/island/badge";
import {
  AWARD_RULES,
  type AwardSource,
  Capped,
  DAILY_STARS,
  DAY_GRANTS,
  Duplicate,
  Granted,
} from "@repo/backend/confect/island/schema";
import { ensureIsland } from "@repo/backend/confect/island/store";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, DateTime, Effect, Match, Option } from "effect";

/** The one key a source holds for good, so the same learning never grants twice. */
const keyOf = Match.type<AwardSource>().pipe(
  Match.tagsExhaustive({
    lesson: (source) => `lesson:${source.content}`,
    section: (source) => `section:${source.set}:${source.section}`,
    set: (source) => `set:${source.set}`,
  })
);

/**
 * Grants the Stars of one piece of learning to its learner, in the caller's
 * transaction (ADR 0042, D8). A key already held grants nothing. A day whose
 * count for the kind, or whose 150 Stars, are reached grants nothing and writes
 * nothing, so the same learning can still earn on another day. Otherwise the
 * grant writes its ledger row with what remains of the day, at most the kind's
 * Stars, raises the island's lifetime, and records the badges it completes. A
 * learner without an island gets one with the starter set.
 */
export const grantAward = Effect.fn("island.grantAward")(function* (
  userId: Id<"users">,
  source: AwardSource
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const key = keyOf(source);
  const held = yield* database
    .table("islandAwards")
    .index("by_userId_and_key", (query) =>
      query.eq("userId", userId).eq("key", key)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(held)) {
    return Duplicate.make({});
  }
  const now = yield* Clock.currentTimeMillis;
  const island = yield* ensureIsland(userId);
  const day = DateTime.formatIsoDate(
    DateTime.makeZonedUnsafe(now, { timeZone: island.timeZone })
  );
  const today = yield* database
    .table("islandAwards")
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
  yield* writer.table("islandAwards").insert(grant).pipe(Effect.orDie);
  const badges = yield* completedBadges(
    grant,
    today.length === 0,
    Arr.map(island.badges, (earned) => earned.badge)
  );
  yield* writer
    .table("islands")
    .patch(island._id, {
      badges: [
        ...island.badges,
        ...Arr.map(badges, (badge) => ({ at: now, badge })),
      ],
      learned: day,
      lifetime: island.lifetime + grant.stars,
    })
    .pipe(Effect.orDie);
  return Granted.make({ badges, stars: grant.stars });
});
