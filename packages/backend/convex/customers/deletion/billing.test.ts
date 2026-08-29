import { beforeEach, describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { cleanupDeletedUserBilling } from "@repo/backend/convex/customers/deletion/billing";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { vi } from "vitest";

const polarGateway = vi.hoisted(() => ({
  deleteCustomer: vi.fn(),
  getCustomerByExternalId: vi.fn(),
}));

vi.mock("@repo/backend/convex/customers/polar/live", () => ({
  polarGateway,
}));

const insertDeletedUser = Effect.fn(
  "customers.deletion.test.insertDeletedUser"
)(function* (ctx: MutationCtx, suffix: string) {
  return yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `deleted:${suffix}`,
      credits: 0,
      creditsResetAt: 1,
      deletedAt: 1,
      email: `deleted-${suffix}@example.invalid`,
      name: "Deleted User",
      plan: "free",
    })
  );
});

const insertOrphanSubscription = Effect.fn(
  "customers.deletion.test.insertOrphanSubscription"
)(function* (ctx: MutationCtx, userId: Id<"users">, polarCustomerId: string) {
  return yield* Effect.promise(() =>
    ctx.db.insert("subscriptions", {
      amount: null,
      cancelAtPeriodEnd: false,
      checkoutId: null,
      createdAt: "2026-07-29T00:00:00.000Z",
      currency: null,
      currentPeriodEnd: null,
      currentPeriodStart: "2026-07-29T00:00:00.000Z",
      customerId: polarCustomerId,
      endedAt: null,
      id: `subscription-${userId}`,
      metadata: {},
      modifiedAt: null,
      productId: "product-deleted-user",
      recurringInterval: null,
      startedAt: "2026-07-29T00:00:00.000Z",
      status: "active",
    })
  );
});

const readBillingState = Effect.fn("customers.deletion.test.readBillingState")(
  function* (ctx: QueryCtx, polarCustomerId: string) {
    const subscriptions = yield* Effect.promise(() =>
      ctx.db.query("subscriptions").collect()
    );
    const tombstone = yield* Effect.promise(() =>
      ctx.db
        .query("customerDeletionTombstones")
        .withIndex("by_polarCustomerId", (query) =>
          query.eq("polarCustomerId", polarCustomerId)
        )
        .unique()
    );

    return { subscriptions, tombstone };
  }
);

describe("customers/deletion/billing", () => {
  beforeEach(() => {
    polarGateway.deleteCustomer.mockReset();
    polarGateway.getCustomerByExternalId.mockReset();
    polarGateway.deleteCustomer.mockReturnValue(Effect.succeed(null));
    polarGateway.getCustomerByExternalId.mockReturnValue(Effect.succeed(null));
  });

  it.effect("checkpoints a discovered Polar ID before external deletion", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.sync(() => posthogTest.register(t));
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const insertedUserId = yield* insertDeletedUser(
                ctx,
                "checkpoint"
              );
              yield* insertOrphanSubscription(
                ctx,
                insertedUserId,
                "polar-checkpoint"
              );
              return insertedUserId;
            })
          )
        )
      );

      polarGateway.getCustomerByExternalId.mockReturnValue(
        Effect.succeed({ id: "polar-checkpoint" })
      );
      polarGateway.deleteCustomer.mockImplementation((polarCustomerId) =>
        Effect.gen(function* () {
          const checkpoint = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                Effect.promise(() =>
                  ctx.db
                    .query("customerDeletionTombstones")
                    .withIndex("by_cleanupUserId", (query) =>
                      query.eq("cleanupUserId", userId)
                    )
                    .unique()
                )
              )
            )
          );

          expect(checkpoint).toMatchObject({
            cleanupUserId: userId,
            polarCustomerId,
          });
          return null;
        })
      );

      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(
            cleanupDeletedUserBilling(ctx, userId, "original-auth-checkpoint")
          )
        )
      );

      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(readBillingState(ctx, "polar-checkpoint"))
        )
      );

      expect(state.subscriptions).toEqual([]);
      expect(state.tombstone).toMatchObject({
        polarCustomerId: "polar-checkpoint",
      });
      expect(state.tombstone).not.toHaveProperty("cleanupUserId");
    })
  );

  it.effect("resumes local cleanup when Polar is no longer discoverable", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.sync(() => posthogTest.register(t));
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const insertedUserId = yield* insertDeletedUser(ctx, "resume");
              yield* Effect.promise(() =>
                ctx.db.insert("customerDeletionTombstones", {
                  cleanupUserId: insertedUserId,
                  polarCustomerId: "polar-resume",
                })
              );
              yield* insertOrphanSubscription(
                ctx,
                insertedUserId,
                "polar-resume"
              );
              return insertedUserId;
            })
          )
        )
      );

      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(
            cleanupDeletedUserBilling(ctx, userId, "original-auth-resume")
          )
        )
      );

      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(readBillingState(ctx, "polar-resume"))
        )
      );

      expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
      expect(polarGateway.deleteCustomer).toHaveBeenCalledWith("polar-resume");
      expect(state.subscriptions).toEqual([]);
      expect(state.tombstone).not.toHaveProperty("cleanupUserId");
    })
  );

  it.effect(
    "removes a Polar customer created after the first cleanup pass",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.sync(() => posthogTest.register(t));
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertDeletedUser(ctx, "late-polar-sync"))
          )
        );
        polarGateway.getCustomerByExternalId
          .mockReturnValueOnce(Effect.succeed(null))
          .mockReturnValueOnce(Effect.succeed({ id: "polar-late-sync" }));

        yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexProgram(
              cleanupDeletedUserBilling(ctx, userId, "original-auth-late-sync")
            )
          )
        );
        expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();

        yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexProgram(
              cleanupDeletedUserBilling(ctx, userId, "original-auth-late-sync")
            )
          )
        );

        expect(polarGateway.deleteCustomer).toHaveBeenCalledOnce();
        expect(polarGateway.deleteCustomer).toHaveBeenCalledWith(
          "polar-late-sync"
        );
      })
  );
});
