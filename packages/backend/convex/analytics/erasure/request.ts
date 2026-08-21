import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { cleanupSource } from "@repo/backend/convex/privacy/spec";
import { workflow } from "@repo/backend/convex/workflow";
import { Effect, Schema } from "effect";

const analyticsErasureRequestFailedCode = "ANALYTICS_ERASURE_REQUEST_FAILED";
type StartAnalyticsErasure = (
  ctx: ActionCtx,
  userId: Id<"users">
) => Promise<unknown>;

/** Raised when a durable consent-overlap erasure cannot be admitted. */
export class AnalyticsErasureRequestError extends Schema.TaggedError<AnalyticsErasureRequestError>()(
  "AnalyticsErasureRequestError",
  {
    code: Schema.Literal(analyticsErasureRequestFailedCode),
    message: Schema.String,
  }
) {}

const startAnalyticsErasure: StartAnalyticsErasure = (ctx, userId) =>
  workflow.start(
    ctx,
    internal.analytics.erasure.workflow.eraseConsentOverlap,
    { userId },
    {
      context: { source: cleanupSource.consentOverlap },
      onComplete: internal.privacy.recovery.handleCleanupComplete,
      startAsync: true,
    }
  );

/** Persists a workflow before returning from an overlapping delivery action. */
export const requestAnalyticsErasure: (
  ctx: ActionCtx,
  userId: Id<"users">,
  startErasure?: StartAnalyticsErasure
) => Effect.Effect<void, AnalyticsErasureRequestError> = Effect.fn(
  "analytics.erasure.request"
)(function* (
  ctx: ActionCtx,
  userId: Id<"users">,
  startErasure: StartAnalyticsErasure = startAnalyticsErasure
) {
  yield* Effect.tryPromise({
    catch: (error) =>
      new AnalyticsErasureRequestError({
        code: analyticsErasureRequestFailedCode,
        message: `Unable to start durable analytics erasure: ${getUnknownErrorMessage(error)}`,
      }),
    try: () => startErasure(ctx, userId),
  });
});
