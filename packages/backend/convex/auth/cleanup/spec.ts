import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

/** Typed failure for the internal deleted-user cleanup workflow. */
export class UserCleanupError extends Schema.TaggedError<UserCleanupError>()(
  "UserCleanupError",
  {
    code: Schema.Literal("USER_CLEANUP_FAILED"),
    message: Schema.String,
  }
) {}

/** Converts a database or scheduler failure into the cleanup error contract. */
export function toUserCleanupError(error: unknown) {
  return new UserCleanupError({
    code: "USER_CLEANUP_FAILED",
    message: getUnknownErrorMessage(error),
  });
}

/** Lifts one Convex cleanup operation into the typed Effect error channel. */
export function tryUserCleanup<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toUserCleanupError,
    try: operation,
  });
}
