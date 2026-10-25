import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import {
  BillingCountry,
  BillingRail,
} from "@repo/backend/confect/billing/schema";
import { Space } from "@repo/backend/confect/space";
import { Effect, Option, Schema } from "effect";

export type BillingAccountId = Docs["billingAccounts"]["_id"];

/** The account that pays for one owner through one rail. An owner has at most one per rail. */
export const findAccount = Effect.fn("billing.accounts.find")(function* (
  owner: Space,
  rail: BillingRail
) {
  const reader = yield* DatabaseReader;
  if (owner.kind === "personal") {
    return yield* reader
      .table("billingAccounts")
      .index("by_userId_and_rail", (query) =>
        query.eq("owner.userId", owner.userId).eq("rail", rail)
      )
      .first()
      .pipe(Effect.orDie);
  }
  return yield* reader
    .table("billingAccounts")
    .index("by_tenantId_and_rail", (query) =>
      query.eq("owner.tenantId", owner.tenantId).eq("rail", rail)
    )
    .first()
    .pipe(Effect.orDie);
});

/** The account whose provider customer on `rail` is `providerCustomerId`, or none. A provider webhook names its account this way. */
export const findAccountByProviderCustomer = Effect.fn(
  "billing.accounts.findByProviderCustomer"
)(function* (rail: BillingRail, providerCustomerId: string) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("billingAccounts")
    .index("by_rail_and_providerCustomerId", (query) =>
      query.eq("rail", rail).eq("providerCustomerId", providerCustomerId)
    )
    .first()
    .pipe(Effect.orDie);
});

/** The owner, rail, country and currency one account is made with. */
const EnsureAccountInput = Schema.Struct({
  owner: Space,
  rail: BillingRail,
  country: BillingCountry,
  currency: BillingCurrency,
});

/**
 * Returns the account of `owner` on `rail`, making it on first use. The country
 * and the currency are fixed when the account is made, so a later move does
 * not change what an existing subscription is billed in.
 */
export const ensureAccount = Effect.fn("billing.accounts.ensure")(function* (
  input: typeof EnsureAccountInput.Type
) {
  const existing = yield* findAccount(input.owner, input.rail);
  if (Option.isSome(existing)) {
    return existing.value._id;
  }
  const writer = yield* DatabaseWriter;
  return yield* writer
    .table("billingAccounts")
    .insert({
      owner: input.owner,
      rail: input.rail,
      country: input.country,
      currency: input.currency,
      providerCustomerId: null,
    })
    .pipe(Effect.orDie);
});

/** Stores the customer the rail created for the account, so later calls reuse it. */
export const recordProviderCustomer = Effect.fn(
  "billing.accounts.recordProviderCustomer"
)(function* (accountId: BillingAccountId, providerCustomerId: string) {
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("billingAccounts")
    .patch(accountId, { providerCustomerId })
    .pipe(Effect.orDie);
});

/**
 * Links a Polar customer to the personal Polar account of the Nakafa user whose
 * Better Auth ID is the customer's external ID. The account is opened on first
 * use, in the billing country Polar holds for the customer, or unknown when it
 * holds none. An account that already names another customer is a conflict, and
 * nothing changes. A user whose account is being deleted links nothing.
 */
export const linkPolarCustomer = Effect.fn(
  "billing.accounts.linkPolarCustomer"
)(function* (input: {
  readonly authId: string;
  readonly country: BillingCountry;
  readonly providerCustomerId: string;
}) {
  const reader = yield* DatabaseReader;
  const user = yield* reader
    .table("users")
    .index("by_authId", (query) => query.eq("authId", input.authId))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(user)) {
    return "noUser" as const;
  }
  if (isAccountDeletionPending(user.value)) {
    return "unavailable" as const;
  }
  const owner = { kind: "personal" as const, userId: user.value._id };
  const existing = yield* findAccount(owner, "polar");
  if (Option.isNone(existing)) {
    const accountId = yield* ensureAccount({
      owner,
      rail: "polar",
      country: input.country,
      currency: billingCurrencyFor(input.country),
    });
    yield* recordProviderCustomer(accountId, input.providerCustomerId);
    return "linked" as const;
  }
  const linked = existing.value.providerCustomerId;
  if (linked === input.providerCustomerId) {
    return "linked" as const;
  }
  if (linked !== null) {
    return "conflict" as const;
  }
  yield* recordProviderCustomer(existing.value._id, input.providerCustomerId);
  return "linked" as const;
});
