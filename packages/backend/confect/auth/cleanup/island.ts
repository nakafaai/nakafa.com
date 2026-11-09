import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const GRANT_BATCH_SIZE = 50;

/**
 * Deletes one bounded batch of a deleted account's island ledger, then its
 * island (ADR 0042, D7). Answers whether anything was deleted, so the cleanup
 * runs again until nothing of the island is left.
 */
export const cleanupUserIsland = Effect.fn("auth.cleanup.cleanupUserIsland")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const grants = yield* database
      .table("islandAwards")
      .index("by_userId_and_key", (query) => query.eq("userId", userId))
      .take(GRANT_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const grant of grants) {
      yield* writer.table("islandAwards").delete(grant._id);
    }
    if (grants.length > 0) {
      return true;
    }
    const islands = yield* database
      .table("islands")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(1)
      .pipe(Effect.orDie);
    for (const island of islands) {
      yield* writer.table("islands").delete(island._id);
    }
    return islands.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
