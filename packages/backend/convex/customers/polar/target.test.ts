import { resolvePolarCustomerWebhookTarget } from "@repo/backend/convex/customers/polar/target";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);

describe("customers/polar/target", () => {
  it("preserves a typed failure when the external identity is ambiguous", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      for (const suffix of ["first", "second"]) {
        await ctx.db.insert("users", {
          authId: "auth-duplicate",
          credits: 0,
          creditsResetAt: NOW,
          email: `${suffix}@example.com`,
          name: `User ${suffix}`,
          plan: "free",
        });
      }
    });

    const result = await t.query((ctx) =>
      Effect.runPromise(
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
    );

    expect(result).toEqual({
      code: "POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED",
      kind: "PolarCustomerWebhookTargetIoError",
    });
  });
});
