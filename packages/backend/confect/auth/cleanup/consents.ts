import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

const CONSENT_CLEANUP_BATCH_SIZE = 32;

/** Deletes one bounded batch of account-owned consent state or provenance. */
export const cleanupUserConsents = Effect.fn(
  "auth.cleanup.cleanupUserConsents"
)(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const consents = yield* database
      .table("accountConsents")
      .index("by_userId_and_category", (query) => query.eq("userId", userId))
      .take(CONSENT_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const consent of consents) {
      yield* writer.table("accountConsents").delete(consent._id);
    }
    if (consents.length > 0) {
      return true;
    }
    const decisions = yield* database
      .table("accountConsentDecisions")
      .index("by_userId_and_category_and_decidedAt", (query) =>
        query.eq("userId", userId)
      )
      .take(CONSENT_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const decision of decisions) {
      yield* writer.table("accountConsentDecisions").delete(decision._id);
    }
    return decisions.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
