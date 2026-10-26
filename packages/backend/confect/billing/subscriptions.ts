import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  billingProviderValidator,
  billingSubscriptionValidator,
} from "@repo/backend/confect/billing/schema";
import { Effect, Option, Schema } from "effect";

type BillingSubscriptionId = Docs["billingSubscriptions"]["_id"];
export type BillingSubscriptionState = typeof billingSubscriptionValidator.Type;
type BillingProvider = typeof billingProviderValidator.Type;

/** What applying one state did: the row it wrote, or the stale state it refused. */
const SubscriptionApplied = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("applied"),
    subscriptionId: IdSchema("billingSubscriptions"),
  }),
  Schema.Struct({
    kind: Schema.Literal("stale"),
    subscriptionId: IdSchema("billingSubscriptions"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));
type SubscriptionApplied = typeof SubscriptionApplied.Type;

/** Finds the row a provider reference names, on the index that reference is unique in. */
const findByProvider = Effect.fn("billing.subscriptions.findByProvider")(
  function* (provider: BillingProvider) {
    const reader = yield* DatabaseReader;
    if (provider.kind === "polar") {
      return yield* reader
        .table("billingSubscriptions")
        .index("by_polar_subscriptionId", (query) =>
          query.eq("provider.subscriptionId", provider.subscriptionId)
        )
        .first()
        .pipe(Effect.orDie);
    }
    // A subscription whose plan has not opened yet is new, never one row of many without a plan.
    const planId = provider.planId;
    if (planId === null) {
      return Option.none();
    }
    return yield* reader
      .table("billingSubscriptions")
      .index("by_xendit_planId", (query) => query.eq("provider.planId", planId))
      .first()
      .pipe(Effect.orDie);
  }
);

/**
 * Writes one provider's state of a subscription. A state older than the stored
 * `providerUpdatedAt` is refused, so a late or retried webhook never moves a
 * subscription back in time. Equal times apply again, which keeps a retry safe.
 */
export const applySubscriptionState = Effect.fn(
  "billing.subscriptions.applyState"
)(function* (state: BillingSubscriptionState) {
  const existing = yield* findByProvider(state.provider);
  const writer = yield* DatabaseWriter;
  if (Option.isNone(existing)) {
    const subscriptionId = yield* writer
      .table("billingSubscriptions")
      .insert(state)
      .pipe(Effect.orDie);
    return { kind: "applied", subscriptionId } satisfies SubscriptionApplied;
  }
  const subscriptionId = existing.value._id;
  if (state.providerUpdatedAt < existing.value.providerUpdatedAt) {
    return { kind: "stale", subscriptionId } satisfies SubscriptionApplied;
  }
  yield* writer
    .table("billingSubscriptions")
    .patch(subscriptionId, state)
    .pipe(Effect.orDie);
  return { kind: "applied", subscriptionId } satisfies SubscriptionApplied;
});

/** The subscription row by its document ID, or null when it no longer exists. */
export const readSubscription = Effect.fn("billing.subscriptions.read")(
  function* (subscriptionId: BillingSubscriptionId) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("billingSubscriptions")
      .get(subscriptionId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** The subscription a Xendit recurring plan belongs to, or none when Nakafa holds no row for that plan. */
export const readSubscriptionByXenditPlan = Effect.fn(
  "billing.subscriptions.readByXenditPlan"
)(function* (planId: string) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("billingSubscriptions")
    .index("by_xendit_planId", (query) => query.eq("provider.planId", planId))
    .first()
    .pipe(Effect.orDie);
});
