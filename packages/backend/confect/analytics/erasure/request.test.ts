import workflowTest from "@convex-dev/workflow/test";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { requestAnalyticsErasure } from "@repo/backend/confect/analytics/erasure/request";
import { cleanupSource } from "@repo/backend/confect/privacy/spec";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { getFunctionName } from "convex/server";
import { convexTest } from "convex-test";
import { Data, Effect } from "effect";

class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
}> {}

class AnalyticsErasureActionRejected extends Data.TaggedError(
  "AnalyticsErasureActionRejected"
)<{
  readonly cause: unknown;
}> {}

describe("analytics erasure request", () => {
  afterEach(() => vi.restoreAllMocks());
  it.effect("admits erasure from the action boundary", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.insert("users", {
                authId: "erasure-request-user",
                credits: 0,
                creditsResetAt: 0,
                email: "erasure-request@example.com",
                name: "Erasure Request",
                plan: "free",
              })
            )
          )
        )
      );
      const startErasure = vi.fn(() => Effect.void);

      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(requestAnalyticsErasure(ctx, userId, startErasure))
        )
      );

      expect(startErasure).toHaveBeenCalledWith(expect.any(Object), userId);
    })
  );

  it.effect("starts the durable erasure workflow", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.sync(() => workflowTest.register(t));
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.insert("users", {
                authId: "durable-erasure-request-user",
                credits: 0,
                creditsResetAt: 0,
                email: "durable-erasure-request@example.com",
                name: "Durable Erasure Request",
                plan: "free",
              })
            )
          )
        )
      );

      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(requestAnalyticsErasure(ctx, userId))
        )
      );

      const admittedWorkflows = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(Effect.promise(() => workflow.list(ctx)))
        )
      );

      expect(admittedWorkflows.page).toEqual([
        expect.objectContaining({
          args: { userId },
          context: { source: cleanupSource.consentOverlap },
          name: getFunctionName(
            internal.analytics.erasure.workflow.eraseConsentOverlap
          ),
        }),
      ]);
    })
  );

  it.effect("surfaces a typed failure when workflow admission fails", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.insert("users", {
                authId: "failed-erasure-request-user",
                credits: 0,
                creditsResetAt: 0,
                email: "failed-erasure-request@example.com",
                name: "Failed Erasure Request",
                plan: "free",
              })
            )
          )
        )
      );
      vi.spyOn(workflow, "start").mockRejectedValue(
        new WorkflowUnavailable({ message: "workflow unavailable" })
      );

      const failure = yield* Effect.flip(
        Effect.tryPromise({
          catch: (cause) => new AnalyticsErasureActionRejected({ cause }),
          try: () =>
            t.action((ctx) =>
              runConvexProgram(requestAnalyticsErasure(ctx, userId))
            ),
        })
      );
      expect(failure).toMatchObject({
        _tag: "AnalyticsErasureActionRejected",
        cause: {
          data: {
            code: "ANALYTICS_ERASURE_REQUEST_FAILED",
            message: expect.stringContaining("workflow unavailable"),
          },
        },
      });
    })
  );
});
