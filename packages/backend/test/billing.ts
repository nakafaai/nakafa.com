import {
  type MutationServices,
  mutationLayer,
} from "@confect/server/RegisteredConvexFunction";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { products } from "@repo/backend/confect/billing/polar/products";
import type { PolarSubscriptionRow } from "@repo/backend/confect/billing/polar/state";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** A convex-test instance over the app schema and every Convex module. */
export function createBillingTestConvex() {
  return convexTest(schema, convexModules);
}

/** Runs one Confect effect inside a test mutation, so its database services read and write the same transaction. */
export function runInMutation<A, E>(
  ctx: MutationCtx,
  effect: Effect.Effect<A, E, MutationServices<typeof databaseSchema>>
) {
  return Effect.runPromise(
    effect.pipe(Effect.provide(mutationLayer(databaseSchema, ctx)))
  );
}

/** One stored Polar subscription row, a month of Pro in rupiah, with the fields a test changes. */
export function polarSubscriptionRow(
  overrides: Partial<PolarSubscriptionRow> = {}
): PolarSubscriptionRow {
  return {
    amount: 79_000,
    cancelAtPeriodEnd: false,
    checkoutId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    currency: "idr",
    currentPeriodEnd: "2026-11-01T00:00:00.000Z",
    currentPeriodStart: "2026-10-01T00:00:00.000Z",
    customerCancellationComment: null,
    customerCancellationReason: null,
    customerId: "cust_polar_1",
    endedAt: null,
    id: "sub_polar_1",
    metadata: {},
    modifiedAt: null,
    productId: products.pro.id,
    recurringInterval: "month",
    startedAt: "2026-10-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}
