import { publicFailure } from "@repo/backend/confect/failure";
import { Effect, Schema } from "effect";
export const USER_CLEANUP_FAILED_CODE = "USER_CLEANUP_FAILED";

/** Typed failure for the internal deleted-user cleanup workflow. */
export class UserCleanupError extends Schema.TaggedError<UserCleanupError>()(
  "UserCleanupError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal(USER_CLEANUP_FAILED_CODE),
    message: Schema.String,
  }
) {}

/** Converts a database or scheduler failure into the cleanup error contract. */
export const UserCleanupErrorWire = publicFailure(UserCleanupError);
export function toUserCleanupError(error: unknown) {
  return UserCleanupError.make({
    cause: error,
    code: USER_CLEANUP_FAILED_CODE,
    message: "Unable to complete account cleanup.",
  });
}

/** Lifts one Convex cleanup operation into the typed Effect error channel. */
export function tryUserCleanup<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toUserCleanupError,
    try: operation,
  });
}
