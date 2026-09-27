import {
  AnalyticsErasureRequestError,
  analyticsErasureRequestFailedCode,
} from "@repo/backend/confect/analytics/erasure/spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type StartAnalyticsErasure = (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<unknown, AnalyticsErasureRequestError>;

/** Converts the Workflow SDK admission failure at its IO boundary. */
const startAnalyticsErasure: StartAnalyticsErasure = Effect.fn(
  "analytics.erasure.start"
)(function* (ctx, userId) {
  return yield* Effect.tryPromise({
    catch: (error) =>
      new AnalyticsErasureRequestError({
        code: analyticsErasureRequestFailedCode,
        message: `Unable to start durable analytics erasure: ${getUnknownErrorMessage(error)}`,
      }),
    try: () =>
      workflow.start(
        ctx,
        internal.analytics.erasure.workflow.eraseConsentOverlap,
        {
          userId,
        },
        {
          context: {
            source: cleanupSource.consentOverlap,
          },
          onComplete: internal.privacy.recovery.handleCleanupComplete,
          startAsync: true,
        }
      ),
  });
});

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
  yield* startErasure(ctx, userId);
});
