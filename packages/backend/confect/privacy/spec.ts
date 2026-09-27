import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { Effect, Schema } from "effect";

const privacyCleanupFailedCode = "PRIVACY_CLEANUP_FAILED";
export const cleanupSource = {
  accountDeletion: "account-deletion",
  consentOverlap: "consent-overlap",
} as const;
export const cleanupSourceValidator = Schema.Union([
  Schema.Literal(cleanupSource.accountDeletion),
  Schema.Literal(cleanupSource.consentOverlap),
]);
export type CleanupSource = Schema.Schema.Type<typeof cleanupSourceValidator>;

/** Typed failure for durable privacy cleanup coordination. */
export class PrivacyCleanupError extends Schema.TaggedError<PrivacyCleanupError>()(
  "PrivacyCleanupError",
  {
    code: Schema.Literal(privacyCleanupFailedCode),
    message: Schema.String,
  }
) {}

/** Lifts one workflow operation into the privacy cleanup error channel. */

export function tryPrivacyCleanup<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toPrivacyCleanupError,
    try: operation,
  });
}
export function toPrivacyCleanupError(error: unknown) {
  return new PrivacyCleanupError({
    code: privacyCleanupFailedCode,
    message: getUnknownErrorMessage(error),
  });
}
