import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const JOURNAL_CLEANUP_BATCH_SIZE = 50;

/**
 * Deletes one bounded batch of a learner's personal journal entries. Personal
 * entries leave with the account, and tenant entries stay with their school
 * (ADR 0016).
 */
export const cleanupUserJournal = Effect.fn("auth.cleanup.cleanupUserJournal")(
  function* (userId: Id<"users">) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const entries = yield* reader
      .table("journalEntries")
      .index("by_owner_userId", (query) => query.eq("owner.userId", userId))
      .take(JOURNAL_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const entry of entries) {
      yield* writer
        .table("journalEntries")
        .delete(entry._id)
        .pipe(Effect.orDie);
    }
    return entries.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
