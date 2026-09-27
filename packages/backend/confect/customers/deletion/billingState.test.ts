import { expect, it } from "@effect/vitest";
import {
  completeCustomerDeletionCheckpointProgram,
  deleteLocalCustomer,
  recordCustomerDeletionCheckpointProgram,
} from "@repo/backend/confect/customers/deletion/billingState";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

it("binds an existing tombstone and refuses checkpoint identity changes", async () => {
  const t = convexTest(schema, convexModules);
  const userId = await t.mutation((ctx) =>
    ctx.db.insert("users", {
      authId: "deleted-user",
      credits: 0,
      creditsResetAt: 1,
      email: "deleted@example.invalid",
      name: "Deleted",
      plan: "free",
      deletedAt: 1,
    })
  );
  await t.mutation((ctx) =>
    runConvexProgram(
      completeCustomerDeletionCheckpointProgram(ctx, userId, "polar")
    )
  );
  await t.mutation((ctx) =>
    runConvexProgram(recordCustomerDeletionCheckpointProgram(ctx, "polar"))
  );
  await t.mutation((ctx) =>
    runConvexProgram(
      recordCustomerDeletionCheckpointProgram(ctx, "polar", userId)
    )
  );
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").unique())
  ).toMatchObject({ polarCustomerId: "polar", cleanupUserId: userId });
  await expect(
    t.mutation((ctx) =>
      runConvexProgram(
        recordCustomerDeletionCheckpointProgram(ctx, "different", userId)
      )
    )
  ).rejects.toMatchObject({ data: { code: "CUSTOMER_SYNC_IO_ERROR" } });
  await expect(
    t.mutation((ctx) =>
      runConvexProgram(
        completeCustomerDeletionCheckpointProgram(ctx, userId, "different")
      )
    )
  ).rejects.toMatchObject({ data: { code: "CUSTOMER_SYNC_IO_ERROR" } });
  await t.mutation((ctx) =>
    runConvexProgram(
      completeCustomerDeletionCheckpointProgram(ctx, userId, "polar")
    )
  );
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").unique())
  ).not.toHaveProperty("cleanupUserId");
});

it("returns a typed failure when a local billing drain cannot commit", async () => {
  const t = convexTest(schema, convexModules);
  const result = await t.action((ctx) => {
    vi.spyOn(ctx, "runMutation").mockRejectedValueOnce(
      new Error("database unavailable")
    );
    return runConvexProgram(
      deleteLocalCustomer(ctx, "polar").pipe(
        Effect.match({
          onFailure: (error) => ({ ...error, message: error.message }),
          onSuccess: () => null,
        })
      )
    );
  });
  expect(result).toMatchObject({
    _tag: "CustomerSyncIoError",
    code: "CUSTOMER_SYNC_IO_ERROR",
    message: "Failed to delete local customer row",
  });
});

it("preserves a typed checkpoint failure without deleting billing data", async () => {
  const t = convexTest(schema, convexModules);
  const failure = await t.mutation((ctx) => {
    vi.spyOn(ctx.db, "insert").mockRejectedValueOnce(
      new Error("database unavailable")
    );
    return runConvexProgram(
      recordCustomerDeletionCheckpointProgram(ctx, "polar").pipe(
        Effect.match({
          onFailure: (error) => ({ ...error, message: error.message }),
          onSuccess: () => null,
        })
      )
    );
  });
  expect(failure).toMatchObject({
    _tag: "CustomerSyncIoError",
    code: "CUSTOMER_SYNC_IO_ERROR",
    message: "Failed to delete local customer data",
  });
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").collect())
  ).toEqual([]);
});

it("preserves billing rows when the native deletion mutation rejects stored metadata", async () => {
  const t = convexTest(schema, convexModules);
  const customerId = await t.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: "invalid-billing",
      credits: 0,
      creditsResetAt: 1,
      email: "invalid-billing@example.invalid",
      name: "Billing",
      plan: "free",
    });
    return ctx.db.insert("customers", {
      id: "polar-invalid",
      externalId: "invalid-billing",
      userId,
      metadata: { value: Number.NaN },
    });
  });
  const before = await t.query((ctx) => ctx.db.get(customerId));
  await expect(
    t.action((ctx) =>
      runConvexProgram(deleteLocalCustomer(ctx, "polar-invalid"))
    )
  ).rejects.toHaveProperty("data", {
    code: "CUSTOMER_SYNC_IO_ERROR",
    message: "Failed to delete local customer row",
  });
  expect(await t.query((ctx) => ctx.db.get(customerId))).toEqual(before);
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").collect())
  ).toEqual([]);
});
