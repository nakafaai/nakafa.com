import posthogTest from "@posthog/convex/test";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupDeletedUserBilling } from "@repo/backend/convex/customers/deletion/billing";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const polarGateway = vi.hoisted(() => ({
  deleteCustomer: vi.fn(),
  getCustomerByExternalId: vi.fn(),
}));

vi.mock("@repo/backend/convex/customers/polar/live", () => ({
  polarGateway,
}));

function insertDeletedUser(ctx: MutationCtx, suffix: string) {
  return ctx.db.insert("users", {
    authId: `deleted:${suffix}`,
    credits: 0,
    creditsResetAt: 1,
    deletedAt: 1,
    email: `deleted-${suffix}@example.invalid`,
    name: "Deleted User",
    plan: "free",
  });
}

function insertOrphanSubscription(
  ctx: MutationCtx,
  userId: Id<"users">,
  polarCustomerId: string
) {
  return ctx.db.insert("subscriptions", {
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
  });
}

describe("customers/deletion/billing", () => {
  beforeEach(() => {
    polarGateway.deleteCustomer.mockReset();
    polarGateway.getCustomerByExternalId.mockReset();
    polarGateway.deleteCustomer.mockReturnValue(Effect.succeed(null));
    polarGateway.getCustomerByExternalId.mockReturnValue(Effect.succeed(null));
  });

  it("checkpoints a discovered Polar ID before external deletion", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await insertDeletedUser(ctx, "checkpoint");
      await insertOrphanSubscription(ctx, insertedUserId, "polar-checkpoint");
      return insertedUserId;
    });

    polarGateway.getCustomerByExternalId.mockReturnValue(
      Effect.succeed({ id: "polar-checkpoint" })
    );
    polarGateway.deleteCustomer.mockImplementation((polarCustomerId) =>
      Effect.tryPromise(async () => {
        const checkpoint = await t.query((ctx) =>
          ctx.db
            .query("customerDeletionTombstones")
            .withIndex("by_cleanupUserId", (query) =>
              query.eq("cleanupUserId", userId)
            )
            .unique()
        );

        expect(checkpoint).toMatchObject({
          cleanupUserId: userId,
          polarCustomerId,
        });
        return null;
      })
    );

    await t.action((ctx) =>
      runConvexProgram(
        cleanupDeletedUserBilling(ctx, userId, "original-auth-checkpoint")
      )
    );

    const state = await t.query(async (ctx) => ({
      subscriptions: await ctx.db.query("subscriptions").collect(),
      tombstone: await ctx.db
        .query("customerDeletionTombstones")
        .withIndex("by_polarCustomerId", (query) =>
          query.eq("polarCustomerId", "polar-checkpoint")
        )
        .unique(),
    }));

    expect(state.subscriptions).toEqual([]);
    expect(state.tombstone).toMatchObject({
      polarCustomerId: "polar-checkpoint",
    });
    expect(state.tombstone).not.toHaveProperty("cleanupUserId");
  });

  it("resumes local cleanup when Polar is no longer discoverable", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await insertDeletedUser(ctx, "resume");
      await ctx.db.insert("customerDeletionTombstones", {
        cleanupUserId: insertedUserId,
        polarCustomerId: "polar-resume",
      });
      await insertOrphanSubscription(ctx, insertedUserId, "polar-resume");
      return insertedUserId;
    });

    await t.action((ctx) =>
      runConvexProgram(
        cleanupDeletedUserBilling(ctx, userId, "original-auth-resume")
      )
    );

    const state = await t.query(async (ctx) => ({
      subscriptions: await ctx.db.query("subscriptions").collect(),
      tombstone: await ctx.db
        .query("customerDeletionTombstones")
        .withIndex("by_polarCustomerId", (query) =>
          query.eq("polarCustomerId", "polar-resume")
        )
        .unique(),
    }));

    expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith("polar-resume");
    expect(state.subscriptions).toEqual([]);
    expect(state.tombstone).not.toHaveProperty("cleanupUserId");
  });

  it("removes a Polar customer created after the first cleanup pass", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);
    const userId = await t.mutation((ctx) =>
      insertDeletedUser(ctx, "late-polar-sync")
    );
    polarGateway.getCustomerByExternalId
      .mockReturnValueOnce(Effect.succeed(null))
      .mockReturnValueOnce(Effect.succeed({ id: "polar-late-sync" }));

    await t.action((ctx) =>
      runConvexProgram(
        cleanupDeletedUserBilling(ctx, userId, "original-auth-late-sync")
      )
    );
    expect(polarGateway.deleteCustomer).not.toHaveBeenCalled();

    await t.action((ctx) =>
      runConvexProgram(
        cleanupDeletedUserBilling(ctx, userId, "original-auth-late-sync")
      )
    );

    expect(polarGateway.deleteCustomer).toHaveBeenCalledOnce();
    expect(polarGateway.deleteCustomer).toHaveBeenCalledWith("polar-late-sync");
  });
});
