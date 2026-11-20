import posthogTest from "@posthog/convex/test";
import type schema from "@repo/backend/convex/schema";
import { internalActionGeneric } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { TestConvex } from "convex-test";

/** The arguments PostHog's capture action receives, as Convex validates them. */
const captureArgs = v.object({
  disableGeoip: v.boolean(),
  distinctId: v.string(),
  event: v.string(),
  properties: v.optional(v.string()),
  timestamp: v.optional(v.number()),
});

/** The arguments PostHog's exception action receives. */
const captureExceptionArgs = v.object({
  additionalProperties: v.optional(v.string()),
  distinctId: v.optional(v.string()),
  errorMessage: v.string(),
  errorName: v.optional(v.string()),
  errorStack: v.optional(v.string()),
});

/**
 * Registers PostHog with the two actions the backend calls, so no test reaches
 * the network: the real component's `fetch` would take the responses a test
 * queued for the model. `capture` receives each event the deployment sends,
 * and may record it or throw to stand for an unavailable PostHog.
 */
export function registerPostHog(
  t: TestConvex<typeof schema>,
  capture: (args: Infer<typeof captureArgs>) => void = () => undefined
) {
  t.registerComponent("posthog", posthogTest.schema, {
    ...posthogTest.modules,
    "./component/lib.ts": async () => ({
      capture: internalActionGeneric({
        args: captureArgs,
        returns: v.null(),
        handler: (_ctx, args) => {
          capture(args);
          return null;
        },
      }),
      captureException: internalActionGeneric({
        args: captureExceptionArgs,
        returns: v.null(),
        handler: () => null,
      }),
    }),
  });
}
