import type { UserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { Effect } from "effect";
/** Drains persisted cleanup batches without growing the workflow journal. */
export const drainDeletedUserDataProgram = Effect.fn(
  "auth.cleanup.drainDeletedUserData"
)(function* (cleanupBatch: Effect.Effect<boolean, UserCleanupError>) {
  let hasMore = true;
  while (hasMore) {
    hasMore = yield* cleanupBatch;
  }
});
