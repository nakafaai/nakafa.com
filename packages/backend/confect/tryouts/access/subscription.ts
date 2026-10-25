import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import type { TryoutStartScope } from "@repo/backend/confect/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { Effect, Option } from "effect";

const RAILS = ["polar", "xendit"] as const;
/** Active subscriptions one account is read through when access is decided, so a read stays bounded. */
const MAX_ACTIVE_SUBSCRIPTIONS = 10;
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;

/**
 * The time a subscription's paid period ends, or null when the period has passed
 * and the subscription grants nothing. A subscription without a period end never ends.
 */
function accessEndsAt(
  subscription: Docs["billingSubscriptions"],
  now: number
): number | null {
  if (subscription.currentPeriodEnd === null) {
    return perpetualSubscriptionEndsAt;
  }
  return subscription.currentPeriodEnd > now
    ? subscription.currentPeriodEnd
    : null;
}

/**
 * Loads the user's first live active Pro subscription on a personal account, on
 * either rail, with the time its paid period ends.
 */
export const loadActiveProSubscription = Effect.fn(
  "tryouts.access.loadActiveProSubscription"
)(
  function* (args: TryoutStartScope) {
    const database = yield* DatabaseReader;
    for (const rail of RAILS) {
      const account = yield* findAccount(
        { kind: "personal", userId: args.userId },
        rail
      );
      if (Option.isNone(account)) {
        continue;
      }
      const subscriptions = yield* database
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", account.value._id).eq("status", "active")
        )
        .take(MAX_ACTIVE_SUBSCRIPTIONS)
        .pipe(Effect.orDie);
      for (const subscription of subscriptions) {
        const endsAt = accessEndsAt(subscription, args.now);
        if (endsAt !== null) {
          return { subscription: { id: subscription._id }, endsAt };
        }
      }
    }
    return null;
  },
  Effect.mapError(toTryoutStartError),
  Effect.catchDefect(() => Effect.fail(toTryoutStartError()))
);
