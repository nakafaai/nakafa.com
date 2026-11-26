import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateTime, Effect, Option } from "effect";

/** The time zone of a progress record created before the learner's own zone is set. */
const FIRST_ZONE = DateTime.zoneMakeNamedUnsafe("UTC");

/** The learner's progress record, none before their first grant. */
export const findProgress = Effect.fn("progress.store.find")(function* (
  userId: Id<"users">
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("progress")
    .index("by_userId", (query) => query.eq("userId", userId))
    .first()
    .pipe(Effect.orDie);
});

/**
 * The learner's progress record, created when they have none yet. A new record
 * starts in the given time zone (UTC by default) with zero Stars and an empty tally.
 */
export const ensureProgress = Effect.fn("progress.store.ensure")(function* (
  userId: Id<"users">,
  timeZone: DateTime.TimeZone.Named = FIRST_ZONE
) {
  const found = yield* findProgress(userId);
  if (Option.isSome(found)) {
    return found.value;
  }
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const progressId = yield* writer
    .table("progress")
    .insert({
      lifetime: 0,
      tally: EMPTY_TALLY,
      timeZone,
      userId,
    })
    .pipe(Effect.orDie);
  return yield* database.table("progress").get(progressId).pipe(Effect.orDie);
});
