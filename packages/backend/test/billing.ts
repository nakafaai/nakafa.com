import {
  type MutationServices,
  mutationLayer,
} from "@confect/server/RegisteredConvexFunction";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { proProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
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

/** Runs one Confect effect inside a test mutation and returns its exit, so a test can assert a typed failure. */
export function exitInMutation<A, E>(
  ctx: MutationCtx,
  effect: Effect.Effect<A, E, MutationServices<typeof databaseSchema>>
) {
  return Effect.runPromiseExit(
    effect.pipe(Effect.provide(mutationLayer(databaseSchema, ctx)))
  );
}

/** Inserts one school with its policies, the shape a school tenant holds. */
export function insertSchool(ctx: MutationCtx) {
  return ctx.db.insert("tenants", {
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: "SMP Uji Pro",
    policies: { emailDomains: [], nina: false, studentThreads: false },
    slug: "smp-uji-pro",
    status: "active",
  });
}

/** Inserts an active member of a school: claimed by `userId`, or unclaimed when none is given. */
export async function insertMember(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  userId: Id<"users"> | null,
  kind: "member" | "operator" = "member"
) {
  await ctx.db.insert("tenantPeople", {
    account:
      userId === null
        ? { state: "unclaimed" }
        : { claimedAt: 0, method: "card", state: "claimed", userId },
    kind,
    name: "Siswa Uji",
    status: "active",
    tenantId,
  });
}

/** Inserts a school grant of ten seats from `validFrom` until `validTo`. */
export async function insertSchoolGrant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  validFrom: number,
  validTo: number
) {
  await ctx.db.insert("billingGrants", {
    product: "school",
    tenantId,
    scope: { kind: "tenant" },
    seats: 10,
    ninaSeats: 0,
    source: { kind: "contract", contractId: "contract-grants-test" },
    validFrom,
    validTo,
  });
}

/** The personal Polar account a test user pays through, with no provider customer unless the test names one. */
export function insertPolarAccount(
  ctx: MutationCtx,
  userId: Id<"users">,
  providerCustomerId: string | null = null
) {
  return ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: "polar",
    country: "ZZ",
    currency: "USD",
    providerCustomerId,
  });
}

/** One Pro subscription on an account. It is active and ends at `PRO_PERIOD_END` unless the test varies it. */
export const PRO_PERIOD_END = Date.UTC(2026, 6, 21, 12, 0, 0);
export function insertProSubscription(
  ctx: MutationCtx,
  accountId: Id<"billingAccounts">,
  overrides: {
    currentPeriodEnd?: number | null;
    status?: "active" | "canceled" | "ended" | "pastDue" | "pending";
    subscriptionId?: string;
  } = {}
) {
  return ctx.db.insert("billingSubscriptions", {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: overrides.status ?? "active",
    currentPeriodStart: PRO_PERIOD_END - 30 * 24 * 60 * 60 * 1000,
    currentPeriodEnd:
      overrides.currentPeriodEnd === undefined
        ? PRO_PERIOD_END
        : overrides.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    provider: {
      kind: "polar",
      subscriptionId: overrides.subscriptionId ?? "sub_polar_test",
      productId: proProductIdFor("sandbox"),
      priceId: null,
    },
    providerUpdatedAt: 0,
  });
}
