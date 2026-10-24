import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  ensureAccount,
  recordProviderCustomer,
} from "@repo/backend/confect/billing/accounts";
import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import { polarBillingState } from "@repo/backend/confect/billing/polar/state";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The country an account copied from Polar is marked with: Indonesia for rupiah, `ZZ` (unknown) otherwise. */
function copiedAccountCountry(currency: BillingCurrency): "ID" | "ZZ" {
  return currency === "IDR" ? "ID" : "ZZ";
}

/** What one stored subscription did: copied, or the reason it was not, so the page can name each skip. */
const CopyOutcome = Schema.Literals([
  "copied",
  "stale",
  "noCustomer",
  "unmapped",
]);
type CopyOutcome = typeof CopyOutcome.Type;

/** One page of the copy: where it starts, and how many subscriptions it reads. */
const CopyRequest = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  numItems: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});

/** What one page of the copy did, and where the next page begins. */
const CopyPage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  copied: Schema.Int,
  skipped: Schema.Int,
});
type CopyPage = typeof CopyPage.Type;

/** Logs one subscription the copy did not write, by its Polar ID and reason, and returns that reason. */
const skip = Effect.fn("billing.migration.skip")(function* (
  subscriptionId: string,
  reason: Exclude<CopyOutcome, "copied">
) {
  yield* Effect.logWarning("Polar subscription was not copied", {
    subscriptionId,
    reason,
  });
  return reason;
});

/** Copies one stored Polar subscription with its customer's account and its grant. */
const copySubscription = Effect.fn("billing.migration.copySubscription")(
  function* (row: Docs["subscriptions"]) {
    const reader = yield* DatabaseReader;
    const customer = yield* reader
      .table("customers")
      .index("by_polarId", (query) => query.eq("id", row.customerId))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(customer)) {
      return yield* skip(row.id, "noCustomer");
    }
    const state = polarBillingState(row);
    if (Option.isNone(state)) {
      return yield* skip(row.id, "unmapped");
    }
    const accountId = yield* ensureAccount({
      owner: { kind: "personal", userId: customer.value.userId },
      rail: "polar",
      country: copiedAccountCountry(state.value.currency),
      currency: state.value.currency,
    });
    yield* recordProviderCustomer(accountId, customer.value.id);
    const applied = yield* applySubscriptionState({
      accountId,
      offer: state.value.offer,
      quantity: 1,
      status: state.value.status,
      currentPeriodStart: state.value.currentPeriodStart,
      currentPeriodEnd: state.value.currentPeriodEnd,
      cancelAtPeriodEnd: state.value.cancelAtPeriodEnd,
      provider: {
        kind: "polar",
        subscriptionId: state.value.subscriptionId,
        productId: state.value.productId,
        priceId: state.value.priceId,
      },
      providerUpdatedAt: state.value.providerUpdatedAt,
    });
    if (applied.kind === "stale") {
      return yield* skip(row.id, "stale");
    }
    yield* syncSubscriptionGrant(applied.subscriptionId);
    return "copied" as const;
  }
);

/**
 * Copies one page of stored Polar subscriptions into the billing tables. The Polar
 * subscription ID is the identity, so a page run twice changes nothing. The
 * operator repeats the call from `continueCursor` until `isDone`, and every
 * subscription the copy does not write is logged with its Polar ID and reason.
 * A customer with no subscription needs no copied account: its currency is
 * known only from a subscription, so its account is made at its first checkout.
 */
export const copyPolarSubscriptionsPage = Effect.fn(
  "billing.migration.copyPolarSubscriptionsPage"
)(function* (page: typeof CopyRequest.Type) {
  const reader = yield* DatabaseReader;
  const result = yield* reader
    .table("subscriptions")
    .index("by_subscriptionId")
    .paginate({ cursor: page.cursor, numItems: page.numItems })
    .pipe(Effect.orDie);
  const outcomes = yield* Effect.forEach(result.page, (row) =>
    copySubscription(row)
  );
  return {
    continueCursor: result.continueCursor,
    isDone: result.isDone,
    copied: Arr.filter(outcomes, (outcome) => outcome === "copied").length,
    skipped: Arr.filter(outcomes, (outcome) => outcome !== "copied").length,
  } satisfies CopyPage;
});
