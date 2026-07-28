import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

export const USER_CLEANUP_FAILED_CODE = "USER_CLEANUP_FAILED";

/** Typed failure for the internal deleted-user cleanup workflow. */
export class UserCleanupError extends Schema.TaggedError<UserCleanupError>()(
  "UserCleanupError",
  {
    code: Schema.Literal(USER_CLEANUP_FAILED_CODE),
    message: Schema.String,
  }
) {}

/** Converts a database or scheduler failure into the cleanup error contract. */
export function toUserCleanupError(error: unknown) {
  return new UserCleanupError({
    code: USER_CLEANUP_FAILED_CODE,
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
