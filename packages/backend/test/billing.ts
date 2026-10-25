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
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

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

/** The provider time the seeded subscription already holds. */
/** The provider time a seeded Xendit subscription already holds. */
const XENDIT_STORED_AT = Date.UTC(2026, 0, 1);

/** One Xendit delivery body, as the route stores it. */
export function xenditDelivery(event: string, data: unknown): string {
  return encodeJsonText({
    business_id: "biz_1",
    created: "2026-10-24T00:00:00Z",
    data,
    event,
  });
}

/** One recurring cycle, paid in its first attempt unless a test overrides a field. */
export function xenditCycle(overrides: Record<string, unknown> = {}) {
  return {
    amount: 79_000,
    attempt_details: [
      {
        created: "2026-10-01T00:01:00Z",
        payment_id: "py_cycle_1",
        status: "SUCCEEDED",
      },
    ],
    currency: "IDR",
    id: "recy_1",
    plan_id: "repl_1",
    scheduled_timestamp: "2026-10-01T00:00:00Z",
    status: "SUCCEEDED",
    updated: "2026-10-01T00:05:00Z",
    ...overrides,
  };
}

/** Stores a pending Xendit subscription of Pro, on a personal account of the given rail. */
export async function seedXenditSubscription(
  ctx: MutationCtx,
  options: {
    planId?: string;
    providerUpdatedAt?: number;
    rail?: "polar" | "xendit";
  } = {}
) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-xendit-${options.planId ?? "plan"}-${options.rail ?? "xendit"}`,
    credits: 0,
    creditsResetAt: 0,
    email: "xendit-process@example.com",
    mascot: MASCOT_CODE,
    name: "Xendit Process",
    plan: "free",
  });
  const accountId = await ctx.db.insert("billingAccounts", {
    owner: { kind: "personal", userId },
    rail: options.rail ?? "xendit",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
  const subscriptionId = await ctx.db.insert("billingSubscriptions", {
    accountId,
    offer: "pro.monthly",
    quantity: 1,
    status: "pending",
    currentPeriodStart: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    provider: {
      kind: "xendit",
      planId: options.planId ?? "repl_1",
      tokenId: null,
      channel: "DANA",
    },
    providerUpdatedAt: options.providerUpdatedAt ?? XENDIT_STORED_AT,
  });
  return { accountId, subscriptionId, userId };
}

/** The validTo of every billing grant stored now. */
export async function readGrantEnds(ctx: MutationCtx) {
  return Arr.map(
    await ctx.db.query("billingGrants").collect(),
    (grant) => grant.validTo
  );
}

/** One Polar subscription webhook body for a Pro subscription of the given customer. */
export function polarProSubscriptionBody(customerId: string): string {
  return encodeJsonText({
    data: {
      cancel_at_period_end: false,
      created_at: "2026-10-01T00:00:00.000Z",
      current_period_end: "2026-11-01T00:00:00.000Z",
      current_period_start: "2026-10-01T00:00:00.000Z",
      customer_id: customerId,
      ended_at: null,
      id: `sub_${customerId}`,
      modified_at: "2026-10-02T00:00:00.000Z",
      product_id: proProductIdFor("sandbox"),
      recurring_interval: "month",
      status: "active",
    },
    timestamp: "2026-10-02T00:00:00.000Z",
    type: "subscription.created",
  });
}
