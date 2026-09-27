import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  completeCustomerDeletionCheckpointProgram,
  deleteLocalCustomer,
  recordCustomerDeletionCheckpointProgram,
} from "@repo/backend/confect/customers/deletion/billingState";
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
  await t.mutation((_ctx) =>
    Effect.runPromise(
      completeCustomerDeletionCheckpointProgram(userId, "polar").pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
        )
      )
    )
  );
  await t.mutation((_ctx) =>
    Effect.runPromise(
      recordCustomerDeletionCheckpointProgram("polar").pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
        )
      )
    )
  );
  await t.mutation((_ctx) =>
    Effect.runPromise(
      recordCustomerDeletionCheckpointProgram("polar", userId).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
        )
      )
    )
  );
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").unique())
  ).toMatchObject({
    polarCustomerId: "polar",
    cleanupUserId: userId,
  });
  await expect(
    t.mutation((_ctx) =>
      Effect.runPromise(
        recordCustomerDeletionCheckpointProgram("different", userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
          )
        )
      )
    )
  ).rejects.toMatchObject({
    code: "CUSTOMER_SYNC_IO_ERROR",
  });
  await expect(
    t.mutation((_ctx) =>
      Effect.runPromise(
        completeCustomerDeletionCheckpointProgram(userId, "different").pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
          )
        )
      )
    )
  ).rejects.toMatchObject({
    code: "CUSTOMER_SYNC_IO_ERROR",
  });
  await t.mutation((_ctx) =>
    Effect.runPromise(
      completeCustomerDeletionCheckpointProgram(userId, "polar").pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
        )
      )
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
    return Effect.runPromise(
      deleteLocalCustomer("polar").pipe(
        Effect.match({
          onFailure: (error) => ({
            ...error,
            message: error.message,
          }),
          onSuccess: () => null,
        }),
        Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
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
    return Effect.runPromise(
      recordCustomerDeletionCheckpointProgram("polar").pipe(
        Effect.match({
          onFailure: (error) => ({
            ...error,
            message: error.message,
          }),
          onSuccess: () => null,
        }),
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
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
      metadata: {
        value: Number.NaN,
      },
    });
  });
  const before = await t.query((ctx) => ctx.db.get(customerId));
  await expect(
    t.action((_ctx) =>
      Effect.runPromise(
        deleteLocalCustomer("polar-invalid").pipe(
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, _ctx))
        )
      )
    )
  ).rejects.toMatchObject({
    code: "CUSTOMER_SYNC_IO_ERROR",
    message: "Failed to delete local customer row",
  });
  expect(await t.query((ctx) => ctx.db.get(customerId))).toEqual(before);
  expect(
    await t.query((ctx) => ctx.db.query("customerDeletionTombstones").collect())
  ).toEqual([]);
});
