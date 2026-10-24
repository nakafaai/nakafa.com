import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import {
  BillingCountry,
  BillingRail,
} from "@repo/backend/confect/billing/schema";
import { Space } from "@repo/backend/confect/space";
import { Effect, Option, Schema } from "effect";

export type BillingAccountId = Docs["billingAccounts"]["_id"];

/** The account that pays for one owner through one rail. An owner has at most one per rail. */
const findAccount = Effect.fn("billing.accounts.find")(function* (
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
