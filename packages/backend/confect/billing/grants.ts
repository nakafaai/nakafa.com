import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  type BillingOfferKey,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import { GrantOwnerMismatch } from "@repo/backend/confect/billing/spec";
import { readSubscription } from "@repo/backend/confect/billing/subscriptions";
import type { Space } from "@repo/backend/confect/space";
import {
  applyPlanChange,
  type PlanSource,
} from "@repo/backend/confect/triggers/subscriptions/impl";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import { DateTime, Effect, Option } from "effect";

/** The grant a subscription writes: the owner's kind follows the offer's product. */
const grantFor = Effect.fn("billing.grants.grantFor")(function* (
  owner: Space,
  offer: BillingOfferKey,
  subscription: {
    readonly id: Docs["billingSubscriptions"]["_id"];
    readonly seats: number;
    readonly validFrom: number;
    readonly validTo: number;
  }
) {
  const source = {
    kind: "subscription" as const,
    subscriptionId: subscription.id,
  };
  const product = billingOffer(offer).product;
  if (owner.kind === "personal" && product === "pro") {
    return {
      product: "pro" as const,
      userId: owner.userId,
      source,
      validFrom: subscription.validFrom,
      validTo: subscription.validTo,
    };
  }
  if (owner.kind === "tenant" && product === "school") {
    return {
      product: "school" as const,
      tenantId: owner.tenantId,
      scope: { kind: "tenant" as const },
      seats: subscription.seats,
      ninaSeats: subscription.seats,
      source,
      validFrom: subscription.validFrom,
      validTo: subscription.validTo,
    };
  }
  return yield* new GrantOwnerMismatch({
    message: `${offer} cannot be granted to a ${owner.kind} owner.`,
  });
});

/**
 * Writes the grant of one subscription. Its window is the paid period, so a
 * subscription that stops renewing keeps its access until that period ends.
 * Writing it again renews the same grant rather than adding one.
 */
export const syncSubscriptionGrant = Effect.fn(
  "billing.grants.syncSubscription"
)(function* (subscriptionId: Docs["billingSubscriptions"]["_id"], now: number) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const subscription = yield* readSubscription(subscriptionId);
  if (subscription === null) {
    return null;
  }
  const account = yield* reader
    .table("billingAccounts")
    .get(subscription.accountId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (account === null) {
    return null;
  }
  const grant = yield* grantFor(account.owner, subscription.offer, {
    id: subscriptionId,
    seats: subscription.quantity,
    validFrom: subscription.currentPeriodStart,
    validTo: subscription.currentPeriodEnd ?? now,
  });
  const existing = yield* reader
    .table("billingGrants")
    .index("by_source_subscriptionId", (query) =>
      query.eq("source.subscriptionId", subscriptionId)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(existing)) {
    yield* writer
      .table("billingGrants")
      .replace(existing.value._id, grant)
      .pipe(Effect.orDie);
    return existing.value._id;
  }
  return yield* writer.table("billingGrants").insert(grant).pipe(Effect.orDie);
});

/**
 * Recomputes one user's plan from the Pro grants that run at `now`, writes it
 * through the existing plan change when it differs, and schedules the next
 * recomputation at the end of the last grant. Returns the plan the user holds.
 * A user whose account is being deleted keeps the plan the deletion leaves.
 */
export const projectUserPlan = Effect.fn("billing.grants.projectUserPlan")(
  function* (userId: Docs["users"]["_id"], now: number) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user === null || isAccountDeletionPending(user)) {
      return null;
    }
    const latest = yield* reader
      .table("billingGrants")
      .index(
        "by_userId_and_validTo",
        (query) => query.eq("userId", userId).gt("validTo", now),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    const plan: UserPlan = latest === null ? "free" : "pro";
    if (plan !== user.plan) {
      const source: PlanSource = {
        id: latest === null ? "expired" : latest._id,
        productId: "pro",
        status: latest === null ? "ended" : "active",
      };
      yield* applyPlanChange(user, plan, now, source);
    }
    if (latest !== null) {
      yield* (yield* Scheduler).runAt(
        DateTime.makeUnsafe(latest.validTo),
        refs.internal.billing.grants.project,
        { userId }
      );
    }
    return plan;
  }
);
