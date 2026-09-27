import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import {
  AnalyticsErasureRequestError,
  analyticsErasureRequestFailedCode,
} from "@repo/backend/confect/analytics/erasure/spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

type StartAnalyticsErasure = (
  userId: Id<"users">
) => Effect.Effect<unknown, AnalyticsErasureRequestError, ActionCtxService>;

/** Converts the Workflow SDK admission failure at its IO boundary. */
const startAnalyticsErasure: StartAnalyticsErasure = Effect.fn(
  "analytics.erasure.start"
)(function* (userId) {
  const ctx = yield* ActionCtxService;
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
export const requestAnalyticsErasure = Effect.fn("analytics.erasure.request")(
  function* (
    userId: Id<"users">,
    startErasure: StartAnalyticsErasure = startAnalyticsErasure
  ) {
    yield* startErasure(userId);
  }
);
