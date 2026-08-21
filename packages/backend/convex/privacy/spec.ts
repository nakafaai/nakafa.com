import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

const privacyCleanupFailedCode = "PRIVACY_CLEANUP_FAILED";
export const cleanupSource = {
  accountDeletion: "account-deletion",
  consentOverlap: "consent-overlap",
} as const;
export const cleanupSourceValidator = v.union(
  v.literal(cleanupSource.accountDeletion),
  v.literal(cleanupSource.consentOverlap)
);
export type CleanupSource = Infer<typeof cleanupSourceValidator>;

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
    catch: (error) =>
      new PrivacyCleanupError({
        code: privacyCleanupFailedCode,
        message: getUnknownErrorMessage(error),
      }),
    try: operation,
  });
}
