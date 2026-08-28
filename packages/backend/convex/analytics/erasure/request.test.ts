import workflowTest from "@convex-dev/workflow/test";
import { assert, describe, expect, it } from "@effect/vitest";
import { requestAnalyticsErasure } from "@repo/backend/convex/analytics/erasure/request";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Cause, Data, Effect, Exit, Result } from "effect";
import { vi } from "vitest";

class WorkflowUnavailable extends Data.TaggedError("WorkflowUnavailable")<{
  readonly message: string;
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
      workflowTest.register(t);
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

      expect(
        yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexProgram(requestAnalyticsErasure(ctx, userId))
          )
        )
      ).toBeNull();
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

      const exit = yield* Effect.exit(
        Effect.promise(() =>
          t.action((ctx) =>
            runConvexProgram(requestAnalyticsErasure(ctx, userId, startErasure))
          )
        )
      );
      assert(Exit.isFailure(exit));

      const defect = Cause.findDefect(exit.cause);
      assert(Result.isSuccess(defect));
      expect(defect.success).toMatchObject({
        data: {
          code: "ANALYTICS_ERASURE_REQUEST_FAILED",
          message: expect.stringContaining("workflow unavailable"),
        },
      });
    })
  );
});
