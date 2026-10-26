import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { BillingRail } from "@repo/backend/confect/billing/schema";
import { Array as Arr, Effect, Option } from "effect";

/** The statuses of a Pro subscription that still holds Pro, or still owes its payment. */
const PRO_HOLDING_STATUSES = ["active", "pastDue"] as const;

/** The most running personal grants read when a user's Pro is weighed. A user holds a few at once at most. */
const RUNNING_GRANT_LIMIT = 16;

/**
 * What Pro one user holds at `now`: a `plan` while a personal Pro subscription
 * is active or past due on either rail, or a running grant comes from anything
 * but a pass; a `pass` while only passes run; `none` otherwise. A plan is managed
 * where it is billed, so no second checkout starts for it. A pass holder may buy
 * another pass, which runs on from the last one.
 */
export const proHoldingOf = Effect.fn("billing.checkout.proHolding")(function* (
  userId: Docs["users"]["_id"],
  now: number
) {
  const reader = yield* DatabaseReader;
  const grants = yield* reader
    .table("billingGrants")
    .index("by_userId_and_validTo", (query) =>
      query.eq("userId", userId).gt("validTo", now)
    )
    .take(RUNNING_GRANT_LIMIT)
    .pipe(Effect.orDie);
  if (Arr.some(grants, (grant) => grant.source.kind !== "pass")) {
    return "plan" as const;
  }
  const accounts = yield* Effect.forEach(BillingRail.literals, (rail) =>
    findAccount({ kind: "personal", userId }, rail)
  );
  for (const account of accounts) {
    if (Option.isNone(account)) {
      continue;
    }
    for (const status of PRO_HOLDING_STATUSES) {
      const subscription = yield* reader
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", account.value._id).eq("status", status)
        )
        .first()
        .pipe(Effect.orDie);
      if (
        Option.isSome(subscription) &&
        billingOffer(subscription.value.offer).product === "pro"
      ) {
        return "plan" as const;
      }
    }
  }
  return Arr.isReadonlyArrayNonEmpty(grants)
    ? ("pass" as const)
    : ("none" as const);
});
