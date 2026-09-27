import { describe, expect, it } from "@effect/vitest";
import { resolvePolarCustomerWebhookTarget } from "@repo/backend/confect/customers/polar/target";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { seedDeletionUser } from "@repo/backend/test/deletion/seed";
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
  it.each(["missing", "deleted", "invalid"])(
    "resolves a %s metadata owner without assigning another account",
    async (state) => {
      const t = convexTest(schema, convexModules);
      const userId = await t.mutation(async (ctx) => {
        const id = await seedDeletionUser(ctx, "webhook-owner", {
          deletedAt: NOW,
        });
        if (state === "missing") {
          await ctx.db.delete("users", id);
        }
        return id;
      });
      await expect(
        t.query(
          internal.customers.queries.internal.customer.resolveWebhookTarget,
          {
            metadataUserId: state === "invalid" ? "invalid-user-id" : userId,
            polarCustomerId: "polar-owner",
          }
        )
      ).resolves.toEqual({ kind: state === "invalid" ? "missing" : state });
    }
  );
});
