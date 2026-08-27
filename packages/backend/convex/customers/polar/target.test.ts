import { describe, expect, it } from "@effect/vitest";
import { resolvePolarCustomerWebhookTarget } from "@repo/backend/convex/customers/polar/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);

describe("customers/polar/target", () => {
  it.effect(
    "preserves a typed failure when the external identity is ambiguous",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);

        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                for (const suffix of ["first", "second"]) {
                  yield* Effect.promise(() =>
                    ctx.db.insert("users", {
                      authId: "auth-duplicate",
                      credits: 0,
                      creditsResetAt: NOW,
                      email: `${suffix}@example.com`,
                      name: `User ${suffix}`,
                      plan: "free",
                    })
                  );
                }
              })
            )
          )
        );

        const result = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              resolvePolarCustomerWebhookTarget(ctx, {
                externalId: "auth-duplicate",
                polarCustomerId: "polar-duplicate",
              }).pipe(
                Effect.match({
                  onFailure: (error) => ({
                    code: error.code,
                    kind: error._tag,
                  }),
                  onSuccess: () => ({ kind: "success" }),
                })
              )
            )
          )
        );

        expect(result).toEqual({
          code: "POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED",
          kind: "PolarCustomerWebhookTargetIoError",
        });
      })
  );
});
