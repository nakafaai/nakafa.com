import { describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getPlanCreditConfig } from "@repo/backend/convex/credits/constants";
import type { CustomerUpsertResult } from "@repo/backend/convex/customers/mutations/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { FunctionArgs } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect } from "effect";

const {
  completeCustomerDeletionCheckpoint,
  deleteCustomerById,
  recordCustomerDeletionCheckpoint,
  upsertCustomer,
} = internal.customers.mutations.internal;
type CustomerTest = TestConvex<typeof schema>;
type CustomerInput = FunctionArgs<typeof upsertCustomer>["customer"];

class ExpectedStoredCustomer extends Data.TaggedError(
  "ExpectedStoredCustomer"
)<{
  readonly result: Exclude<CustomerUpsertResult, { readonly kind: "stored" }>;
}> {}

/** Inserts a user row for customer reconciliation tests. */
const insertUser = Effect.fn("customers.mutations.test.insertUser")(function* (
  ctx: MutationCtx,
  suffix: string
) {
  return yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${suffix}`,
      credits: 10,
      creditsResetAt: 1,
      email: `${suffix}@example.com`,
      name: suffix,
      plan: "free",
    })
  );
});

/** Inserts a local customer row owned by one user. */
const insertCustomer = Effect.fn("customers.mutations.test.insertCustomer")(
  function* (ctx: MutationCtx, polarId: string, userId: Id<"users">) {
    return yield* Effect.promise(() =>
      ctx.db.insert("customers", {
        id: polarId,
        externalId: null,
        metadata: {},
        userId,
      })
    );
  }
);

const createUser = Effect.fn("customers.mutations.test.createUser")(function* (
  t: CustomerTest,
  suffix: string
) {
  return yield* Effect.promise(() =>
    t.mutation((ctx) => runConvexProgram(insertUser(ctx, suffix)))
  );
});

const writeCustomer = Effect.fn("customers.mutations.test.writeCustomer")(
  function* (t: CustomerTest, customer: CustomerInput) {
    return yield* Effect.promise(() =>
      t.mutation(upsertCustomer, { customer })
    );
  }
);

const readCustomer = Effect.fn("customers.mutations.test.readCustomer")(
  function* (t: CustomerTest, customerId: Id<"customers">) {
    return yield* Effect.promise(() =>
      t.query((ctx) =>
        runConvexProgram(Effect.promise(() => ctx.db.get(customerId)))
      )
    );
  }
);

const readCustomers = Effect.fn("customers.mutations.test.readCustomers")(
  function* (t: CustomerTest) {
    return yield* Effect.promise(() =>
      t.query((ctx) =>
        runConvexProgram(
          Effect.promise(() => ctx.db.query("customers").collect())
        )
      )
    );
  }
);

/** Narrows one successful customer upsert after asserting its contract. */
const getStoredCustomerId = Effect.fn(
  "customers.mutations.test.getStoredCustomerId"
)(function* (result: CustomerUpsertResult) {
  if (result.kind !== "stored") {
    return yield* new ExpectedStoredCustomer({ result });
  }

  return result.customerId;
});

describe("customers/mutations", () => {
  it.effect("inserts a new customer when no local row exists", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* createUser(t, "new");
      const input = {
        id: "polar-new",
        externalId: "auth-new",
        metadata: { userId },
        userId,
      };
      const result = yield* writeCustomer(t, input);
      const customerId = yield* getStoredCustomerId(result);
      const customer = yield* readCustomer(t, customerId);
      expect(customer).toMatchObject(input);
    })
  );

  it.effect("patches the same row when user and Polar id both match", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const state = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const userId = yield* insertUser(ctx, "same");
              const customerId = yield* insertCustomer(
                ctx,
                "polar-same",
                userId
              );
              return { customerId, userId };
            })
          )
        )
      );
      const input = {
        id: "polar-same",
        externalId: "auth-same",
        metadata: { tier: "pro" },
        userId: state.userId,
      };
      const result = yield* writeCustomer(t, input);
      const resultId = yield* getStoredCustomerId(result);
      const customer = yield* readCustomer(t, resultId);
      expect(resultId).toBe(state.customerId);
      expect(customer).toMatchObject(input);
    })
  );

  it.effect(
    "patches an existing Polar row when only the Polar id matches",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const state = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const oldUserId = yield* insertUser(ctx, "old-polar");
                const newUserId = yield* insertUser(ctx, "new-polar");
                const customerId = yield* insertCustomer(
                  ctx,
                  "polar-only",
                  oldUserId
                );
                return { customerId, newUserId };
              })
            )
          )
        );
        const input = {
          id: "polar-only",
          externalId: "auth-new-polar",
          metadata: { userId: state.newUserId },
          userId: state.newUserId,
        };
        const result = yield* writeCustomer(t, input);
        const resultId = yield* getStoredCustomerId(result);
        const customer = yield* readCustomer(t, resultId);
        expect(resultId).toBe(state.customerId);
        expect(customer).toMatchObject(input);
      })
  );

  it.effect("patches an existing user row when only the user matches", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const state = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const userId = yield* insertUser(ctx, "user-only");
              const customerId = yield* insertCustomer(
                ctx,
                "polar-stale",
                userId
              );
              return { customerId, userId };
            })
          )
        )
      );
      const input = {
        id: "polar-fresh",
        externalId: "auth-user-only",
        metadata: { userId: state.userId },
        userId: state.userId,
      };
      const result = yield* writeCustomer(t, input);
      const resultId = yield* getStoredCustomerId(result);
      const customer = yield* readCustomer(t, resultId);
      expect(resultId).toBe(state.customerId);
      expect(customer).toMatchObject(input);
    })
  );

  it.effect(
    "reconciles local rows by Polar customer id and removes stale duplicates",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const state = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const staleUserId = yield* insertUser(ctx, "stale");
                const currentUserId = yield* insertUser(ctx, "current");
                yield* insertCustomer(ctx, "polar-target", staleUserId);
                yield* insertCustomer(ctx, "polar-stale-user", currentUserId);
                return { currentUserId };
              })
            )
          )
        );
        const result = yield* writeCustomer(t, {
          id: "polar-target",
          externalId: "auth-current",
          metadata: { userId: state.currentUserId },
          userId: state.currentUserId,
        });
        const reconciledId = yield* getStoredCustomerId(result);
        const customers = yield* readCustomers(t);
        expect(customers).toHaveLength(1);
        expect(customers[0]).toMatchObject({
          _id: reconciledId,
          externalId: "auth-current",
          id: "polar-target",
          userId: state.currentUserId,
        });
      })
  );

  it.effect("drains every subscription batch before deleting a customer", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.sync(() => posthogTest.register(t));
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const userId = yield* insertUser(ctx, "delete");
              yield* Effect.promise(() =>
                ctx.db.patch("users", userId, {
                  credits: getPlanCreditConfig("pro").amount,
                  plan: "pro",
                })
              );
              yield* insertCustomer(ctx, "polar-delete", userId);
              for (let index = 0; index <= 50; index += 1) {
                yield* Effect.promise(() =>
                  ctx.db.insert("subscriptions", {
                    amount: null,
                    cancelAtPeriodEnd: false,
                    checkoutId: null,
                    createdAt: "2026-07-27T00:00:00.000Z",
                    currency: null,
                    currentPeriodEnd: null,
                    currentPeriodStart: "2026-07-27T00:00:00.000Z",
                    customerId: "polar-delete",
                    endedAt: null,
                    id: `subscription-delete-${index}`,
                    metadata: {},
                    modifiedAt: null,
                    productId: products.pro.id,
                    recurringInterval: null,
                    startedAt: "2026-07-27T00:00:00.000Z",
                    status: "active",
                  })
                );
              }
              return userId;
            })
          )
        )
      );
      let hasMore = true;
      let mutationCount = 0;
      while (hasMore) {
        hasMore = yield* Effect.promise(() =>
          t.mutation(deleteCustomerById, {
            id: "polar-delete",
          })
        );
        mutationCount += 1;
      }
      expect(mutationCount).toBe(2);
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.all({
              customers: Effect.promise(() =>
                ctx.db.query("customers").collect()
              ),
              subscriptions: Effect.promise(() =>
                ctx.db.query("subscriptions").collect()
              ),
              tombstones: Effect.promise(() =>
                ctx.db.query("customerDeletionTombstones").collect()
              ),
              user: Effect.promise(() => ctx.db.get("users", userId)),
            })
          )
        )
      );
      expect(state).toEqual({
        customers: [],
        subscriptions: [],
        tombstones: [
          expect.objectContaining({ polarCustomerId: "polar-delete" }),
        ],
        user: expect.objectContaining({
          credits: getPlanCreditConfig("free").amount,
          plan: "free",
        }),
      });
    })
  );

  it.effect("records and completes a customer deletion checkpoint", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* createUser(t, "checkpoint");
      const checkpoint = {
        polarCustomerId: "polar-checkpoint",
        userId,
      };
      expect(
        yield* Effect.promise(() =>
          t.mutation(recordCustomerDeletionCheckpoint, checkpoint)
        )
      ).toBeNull();
      expect(
        yield* Effect.promise(() =>
          t.mutation(completeCustomerDeletionCheckpoint, checkpoint)
        )
      ).toBeNull();
      const [completed] = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.query("customerDeletionTombstones").collect()
            )
          )
        )
      );
      expect(completed).toMatchObject({
        polarCustomerId: checkpoint.polarCustomerId,
      });
      expect(completed).not.toHaveProperty("cleanupUserId");
    })
  );

  it.effect("does not recreate customer data for a prepared user", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* createUser(t, "prepared");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.patch("users", userId, { deletionPreparedAt: 1 })
            )
          )
        )
      );
      const result = yield* writeCustomer(t, {
        id: "polar-prepared",
        externalId: "auth-prepared",
        metadata: { userId },
        userId,
      });
      const customers = yield* readCustomers(t);
      expect(result).toEqual({ kind: "prepared" });
      expect(customers).toEqual([]);
    })
  );

  it.effect("returns missing for a missing user", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* createUser(t, "missing");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(Effect.promise(() => ctx.db.delete("users", userId)))
        )
      );
      const result = yield* writeCustomer(t, {
        id: "polar-missing",
        externalId: "auth-missing",
        metadata: { userId },
        userId,
      });
      expect(result).toEqual({ kind: "missing" });
    })
  );

  it.effect("returns deleted for a deleted user", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* createUser(t, "deleted");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.patch("users", userId, { deletedAt: 1 })
            )
          )
        )
      );
      const result = yield* writeCustomer(t, {
        id: "polar-deleted-user",
        externalId: "auth-deleted-user",
        metadata: { userId },
        userId,
      });
      expect(result).toEqual({ kind: "deleted" });
    })
  );

  it.effect(
    "does not recreate a customer after its Polar deletion tombstone",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const userId = yield* createUser(t, "terminal");
        yield* Effect.promise(() =>
          t.mutation(deleteCustomerById, {
            id: "polar-terminal",
          })
        );
        const result = yield* writeCustomer(t, {
          id: "polar-terminal",
          externalId: "auth-terminal",
          metadata: { userId },
          userId,
        });
        const customers = yield* readCustomers(t);
        expect(result).toEqual({ kind: "deleted" });
        expect(customers).toEqual([]);
      })
  );

  it.effect("ignores delete requests for unknown Polar ids", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      expect(
        yield* Effect.promise(() =>
          t.mutation(deleteCustomerById, {
            id: "missing-polar",
          })
        )
      ).toBe(false);
      const tombstones = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.query("customerDeletionTombstones").collect()
            )
          )
        )
      );
      expect(tombstones).toEqual([
        expect.objectContaining({ polarCustomerId: "missing-polar" }),
      ]);
    })
  );
});
