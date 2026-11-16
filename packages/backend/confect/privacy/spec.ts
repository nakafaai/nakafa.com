import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { Effect, Schema } from "effect";

const privacyCleanupFailedCode = "PRIVACY_CLEANUP_FAILED";
export const cleanupSource = {
  accountDeletion: "account-deletion",
} as const;
export const cleanupSourceValidator = Schema.Literal(
  cleanupSource.accountDeletion
);
export type CleanupSource = typeof cleanupSourceValidator.Type;

/** Typed failure for durable privacy cleanup coordination. */
export class PrivacyCleanupError extends Schema.TaggedError<
  PrivacyCleanupError,
  { readonly brand: unique symbol }
>()("PrivacyCleanupError", {
  code: Schema.Literal(privacyCleanupFailedCode),
  message: Schema.String,
}) {}

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
