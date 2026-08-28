import workflowTest from "@convex-dev/workflow/test";
import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { requestAnalyticsErasure } from "@repo/backend/convex/analytics/erasure/request";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { cleanupSource } from "@repo/backend/convex/privacy/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { workflow } from "@repo/backend/convex/workflow";
import { getFunctionName } from "convex/server";
import { convexTest } from "convex-test";
import { Data, Effect } from "effect";
import { vi } from "vitest";

class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
}> {}

class AnalyticsErasureActionRejected extends Data.TaggedError(
  "AnalyticsErasureActionRejected"
)<{
  readonly cause: unknown;
}> {}

describe("analytics erasure request", () => {
  it.effect("admits erasure from the action boundary", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: "erasure-request-user",
            credits: 0,
            creditsResetAt: 0,
            email: "erasure-request@example.com",
            name: "Erasure Request",
            plan: "free",
          })
        )
      );
      const startErasure = vi.fn(() => Promise.resolve(undefined));

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
          ctx.db.insert("users", {
            authId: "durable-erasure-request-user",
            credits: 0,
            creditsResetAt: 0,
            email: "durable-erasure-request@example.com",
            name: "Durable Erasure Request",
            plan: "free",
          })
        )
      );

      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(requestAnalyticsErasure(ctx, userId))
        )
      );

      const admittedWorkflows = yield* Effect.promise(() =>
        t.action((ctx) => workflow.list(ctx))
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
          ctx.db.insert("users", {
            authId: "failed-erasure-request-user",
            credits: 0,
            creditsResetAt: 0,
            email: "failed-erasure-request@example.com",
            name: "Failed Erasure Request",
            plan: "free",
          })
        )
      );
      const startErasure = vi.fn(() =>
        Promise.reject(
          new WorkflowUnavailable({ message: "workflow unavailable" })
        )
      );

      const failure = yield* Effect.flip(
        Effect.tryPromise({
          catch: (cause) => new AnalyticsErasureActionRejected({ cause }),
          try: () =>
            t.action((ctx) =>
              runConvexProgram(
                requestAnalyticsErasure(ctx, userId, startErasure)
              )
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
