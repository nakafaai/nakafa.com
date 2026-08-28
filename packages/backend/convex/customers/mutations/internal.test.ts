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

type CustomerTest = TestConvex<typeof schema>;
type CustomerInput = FunctionArgs<
  typeof internal.customers.mutations.internal.upsertCustomer
>["customer"];

class ExpectedStoredCustomer extends Data.TaggedError(
  "ExpectedStoredCustomer"
)<{
  readonly result: Exclude<CustomerUpsertResult, { readonly kind: "stored" }>;
}> {}

const customerUpsertCases = [
  { externalId: "auth-new", id: "polar-new", match: "none" },
  { externalId: "auth-same", id: "polar-same", match: "both" },
  { externalId: "auth-new-polar", id: "polar-only", match: "polar" },
  { externalId: "auth-user-only", id: "polar-fresh", match: "user" },
] as const;

type CustomerMatch = (typeof customerUpsertCases)[number]["match"];

/** Inserts a user row for customer reconciliation tests. */
const insertCustomerUser = Effect.fn("customers.mutations.test.insertUser")(
  function* (ctx: MutationCtx, suffix: string) {
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
  }
);

/** Inserts a local customer row owned by one user. */
const insertCustomerRow = Effect.fn("customers.mutations.test.insertCustomer")(
  function* (
    ctx: MutationCtx,
    {
      polarId,
      userId,
    }: {
      polarId: string;
      userId: Id<"users">;
    }
  ) {
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

const insertCustomerState = Effect.fn(
  "customers.mutations.test.insertCustomerState"
)(function* (ctx: MutationCtx, suffix: string, polarId: string) {
  const userId = yield* insertCustomerUser(ctx, suffix);
  const customerId = yield* insertCustomerRow(ctx, { polarId, userId });
  return { customerId, userId };
});

const createCustomerUser = Effect.fn(
  "customers.mutations.test.createCustomerUser"
)(function* (t: CustomerTest, suffix: string) {
  return yield* Effect.promise(() =>
    t.mutation((ctx) => runConvexProgram(insertCustomerUser(ctx, suffix)))
  );
});

const createCustomerState = Effect.fn(
  "customers.mutations.test.createCustomerState"
)(function* (t: CustomerTest, suffix: string, polarId: string) {
  return yield* Effect.promise(() =>
    t.mutation((ctx) =>
      runConvexProgram(insertCustomerState(ctx, suffix, polarId))
    )
  );
});

const createCustomerMatchState = Effect.fn(
  "customers.mutations.test.createCustomerMatchState"
)(function* (t: CustomerTest, match: CustomerMatch) {
  if (match === "none") {
    return { userId: yield* createCustomerUser(t, "new") };
  }
  if (match === "both") {
    return yield* createCustomerState(t, "same", "polar-same");
  }
  if (match === "user") {
    return yield* createCustomerState(t, "user-only", "polar-stale");
  }

  return yield* Effect.promise(() =>
    t.mutation((ctx) =>
      runConvexProgram(
        Effect.gen(function* () {
          const { customerId } = yield* insertCustomerState(
            ctx,
            "old-polar",
            "polar-only"
          );
          const userId = yield* insertCustomerUser(ctx, "new-polar");
          return { customerId, userId };
        })
      )
    )
  );
});

const upsertCustomer = Effect.fn("customers.mutations.test.upsertCustomer")(
  function* (t: CustomerTest, customer: CustomerInput) {
    return yield* Effect.promise(() =>
      t.mutation(internal.customers.mutations.internal.upsertCustomer, {
        customer,
      })
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

const collectCustomers = Effect.fn("customers.mutations.test.collectCustomers")(
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

const readTombstone = Effect.fn("customers.mutations.test.readTombstone")(
  function* (t: CustomerTest, polarCustomerId: string) {
    return yield* Effect.promise(() =>
      t.query((ctx) =>
        runConvexProgram(
          Effect.promise(() =>
            ctx.db
              .query("customerDeletionTombstones")
              .withIndex("by_polarCustomerId", (query) =>
                query.eq("polarCustomerId", polarCustomerId)
              )
              .unique()
          )
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
  it.effect.each(customerUpsertCases)(
    "reconciles $match customer rows",
    ({ externalId, id, match }) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const state = yield* createCustomerMatchState(t, match);
        const metadata: CustomerInput["metadata"] =
          match === "both" ? { tier: "pro" } : { userId: state.userId };
        const result = yield* upsertCustomer(t, {
          externalId,
          id,
          metadata,
          userId: state.userId,
        });
        const resultId = yield* getStoredCustomerId(result);
        const customer = yield* readCustomer(t, resultId);

        if ("customerId" in state) {
          expect(resultId).toBe(state.customerId);
        }
        expect(customer).toMatchObject({
          externalId,
          id,
          metadata,
          userId: state.userId,
        });
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
                yield* insertCustomerState(ctx, "stale", "polar-target");
                const currentUserId = yield* insertCustomerUser(ctx, "current");
                yield* insertCustomerRow(ctx, {
                  polarId: "polar-stale-user",
                  userId: currentUserId,
                });
                return { currentUserId };
              })
            )
          )
        );
        const result = yield* upsertCustomer(t, {
          id: "polar-target",
          externalId: "auth-current",
          metadata: { userId: state.currentUserId },
          userId: state.currentUserId,
        });
        const reconciledId = yield* getStoredCustomerId(result);
        const customers = yield* collectCustomers(t);

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
              const state = yield* insertCustomerState(
                ctx,
                "delete",
                "polar-delete"
              );
              yield* Effect.promise(() =>
                ctx.db.patch("users", state.userId, {
                  credits: getPlanCreditConfig("pro").amount,
                  plan: "pro",
                })
              );
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
              return state.userId;
            })
          )
        )
      );
      let hasMore = true;
      let mutationCount = 0;

      while (hasMore) {
        hasMore = yield* Effect.promise(() =>
          t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
            id: "polar-delete",
          })
        );
        mutationCount += 1;
      }

      expect(mutationCount).toBe(2);

      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const customers = yield* Effect.promise(() =>
                ctx.db.query("customers").collect()
              );
              const subscriptions = yield* Effect.promise(() =>
                ctx.db.query("subscriptions").collect()
              );
              const tombstones = yield* Effect.promise(() =>
                ctx.db.query("customerDeletionTombstones").collect()
              );
              const user = yield* Effect.promise(() =>
                ctx.db.get("users", userId)
              );
              return { customers, subscriptions, tombstones, user };
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
      const userId = yield* createCustomerUser(t, "checkpoint");
      const checkpoint = {
        polarCustomerId: "polar-checkpoint",
        userId,
      };

      expect(
        yield* Effect.promise(() =>
          t.mutation(
            internal.customers.mutations.internal
              .recordCustomerDeletionCheckpoint,
            checkpoint
          )
        )
      ).toBeNull();

      const recorded = yield* readTombstone(t, checkpoint.polarCustomerId);
      expect(recorded).toMatchObject({
        cleanupUserId: userId,
        polarCustomerId: checkpoint.polarCustomerId,
      });

      expect(
        yield* Effect.promise(() =>
          t.mutation(
            internal.customers.mutations.internal
              .completeCustomerDeletionCheckpoint,
            checkpoint
          )
        )
      ).toBeNull();

      const completed = yield* readTombstone(t, checkpoint.polarCustomerId);
      expect(completed).toMatchObject({
        polarCustomerId: checkpoint.polarCustomerId,
      });
      expect(completed).not.toHaveProperty("cleanupUserId");
    })
  );

  it.effect.each([
    { kind: "prepared" },
    { kind: "missing" },
    { kind: "deleted" },
  ] as const)("does not store a customer for a $kind user", ({ kind }) =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const insertedUserId = yield* insertCustomerUser(ctx, kind);
              if (kind === "missing") {
                yield* Effect.promise(() =>
                  ctx.db.delete("users", insertedUserId)
                );
                return insertedUserId;
              }
              yield* Effect.promise(() =>
                ctx.db.patch(
                  "users",
                  insertedUserId,
                  kind === "prepared"
                    ? { deletionPreparedAt: 1 }
                    : { deletedAt: 1 }
                )
              );
              return insertedUserId;
            })
          )
        )
      );
      const result = yield* upsertCustomer(t, {
        id: `polar-${kind}`,
        externalId: `auth-${kind}`,
        metadata: { userId },
        userId,
      });
      const customers = yield* collectCustomers(t);

      expect(result).toEqual({ kind });
      expect(customers).toEqual([]);
    })
  );

  it.effect(
    "does not recreate a customer after its Polar deletion tombstone",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const userId = yield* createCustomerUser(t, "terminal");

        yield* Effect.promise(() =>
          t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
            id: "polar-terminal",
          })
        );
        const result = yield* upsertCustomer(t, {
          id: "polar-terminal",
          externalId: "auth-terminal",
          metadata: { userId },
          userId,
        });
        const customers = yield* collectCustomers(t);

        expect(result).toEqual({ kind: "deleted" });
        expect(customers).toEqual([]);
      })
  );

  it.effect("ignores delete requests for unknown Polar ids", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);

      expect(
        yield* Effect.promise(() =>
          t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
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
