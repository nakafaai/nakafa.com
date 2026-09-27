import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import { cleanupDeletedUserBilling } from "@repo/backend/confect/customers/deletion/billing";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Data, Effect } from "effect";

class BillingStorageUnavailable extends Data.TaggedError(
  "BillingStorageUnavailable"
)<{
  readonly message: string;
}> {}

const polarGateway = vi.hoisted(() => ({
  deleteCustomer: vi.fn(),
  getCustomerByExternalId: vi.fn(),
}));

vi.mock("@repo/backend/confect/customers/polar/live", () => ({
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
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    polarGateway.deleteCustomer.mockReset();
    polarGateway.getCustomerByExternalId.mockReset();
    polarGateway.deleteCustomer.mockReturnValue(Effect.succeed(null));
    polarGateway.getCustomerByExternalId.mockReturnValue(Effect.succeed(null));
  });

  it("preserves the durable identity when local deletion fails after Polar deletion, then resumes", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);
    const userId = await t.mutation(async (ctx) => {
      const id = await runConvexProgram(insertDeletedUser(ctx, "local-retry"));
      await runConvexProgram(
        insertOrphanSubscription(ctx, id, "polar-local-retry")
      );
      return id;
    });
    polarGateway.getCustomerByExternalId.mockReturnValueOnce(
      Effect.succeed({ id: "polar-local-retry" })
    );
    await expect(
      t.action((ctx) => {
        const original = ctx.runMutation;
        vi.spyOn(ctx, "runMutation")
          .mockImplementationOnce(original)
          .mockRejectedValueOnce(
            new BillingStorageUnavailable({ message: "database unavailable" })
          );
        return runConvexProgram(
          cleanupDeletedUserBilling(ctx, userId, "original-local-retry")
        );
      })
    ).rejects.toMatchObject({ data: { code: "CUSTOMER_SYNC_IO_ERROR" } });
    const interrupted = await t.query((ctx) =>
      runConvexProgram(readBillingState(ctx, "polar-local-retry"))
    );
    expect(interrupted.subscriptions).toHaveLength(1);
    expect(interrupted.tombstone).toMatchObject({
      cleanupUserId: userId,
      polarCustomerId: "polar-local-retry",
    });
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith(
      "polar-local-retry"
    );

    await t.action((ctx) =>
      runConvexProgram(
        cleanupDeletedUserBilling(ctx, userId, "original-local-retry")
      )
    );
    const completed = await t.query((ctx) =>
      runConvexProgram(readBillingState(ctx, "polar-local-retry"))
    );
    expect(completed.subscriptions).toEqual([]);
    expect(completed.tombstone).not.toHaveProperty("cleanupUserId");
    expect(polarGateway.getCustomerByExternalId).toHaveBeenCalledOnce();
  });

  it("returns a typed storage failure before contacting Polar when billing identity cannot be read", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      runConvexProgram(insertDeletedUser(ctx, "unreadable"))
    );
    await expect(
      t.action((ctx) => {
        vi.spyOn(ctx, "runQuery").mockRejectedValueOnce(
          new BillingStorageUnavailable({ message: "database unavailable" })
        );
        return runConvexProgram(
          cleanupDeletedUserBilling(ctx, userId, "original-unreadable")
        );
      })
    ).rejects.toMatchObject({
      data: {
        code: "CUSTOMER_SYNC_IO_ERROR",
        message: "Failed to clean up deleted customer billing",
      },
    });
    expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(
      await t.query((ctx) =>
        ctx.db.query("customerDeletionTombstones").collect()
      )
    ).toEqual([]);
  });

  it("refuses to delete a Polar customer when its durable checkpoint names another identity", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const id = await runConvexProgram(
        insertDeletedUser(ctx, "conflicting-polar")
      );
      await ctx.db.insert("customers", {
        id: "current-polar-customer",
        externalId: "original-auth",
        userId: id,
      });
      await ctx.db.insert("customerDeletionTombstones", {
        cleanupUserId: id,
        polarCustomerId: "different-polar-customer",
      });
      return id;
    });
    const read = () =>
      t.query(async (ctx) => ({
        customers: await ctx.db.query("customers").collect(),
        tombstones: await ctx.db.query("customerDeletionTombstones").collect(),
      }));
    const before = await read();
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          cleanupDeletedUserBilling(ctx, userId, "original-auth")
        )
      )
    ).rejects.toMatchObject({ data: { code: "CUSTOMER_SYNC_IO_ERROR" } });
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();
    expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
    expect(await read()).toEqual(before);
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
