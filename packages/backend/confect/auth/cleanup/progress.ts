import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const GRANT_BATCH_SIZE = 50;

/**
 * Deletes one bounded batch of what a deleted account left in progress: its
 * Star grants ledger and then its progress record. Answers whether anything
 * was deleted, so cleanup runs again until nothing remains.
 */
export const cleanupUserProgress = Effect.fn(
  "auth.cleanup.cleanupUserProgress"
)(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const grants = yield* database
      .table("progressAwards")
      .index("by_userId_and_key", (query) => query.eq("userId", userId))
      .take(GRANT_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const grant of grants) {
      yield* writer.table("progressAwards").delete(grant._id);
    }
    if (grants.length > 0) {
      return true;
    }
    const records = yield* database
      .table("progress")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(1)
      .pipe(Effect.orDie);
    for (const record of records) {
      yield* writer.table("progress").delete(record._id);
    }
    return records.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
