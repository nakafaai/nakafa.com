import { findAccountByProviderCustomer } from "@repo/backend/confect/billing/accounts";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import {
  decodePolarEnvelope,
  decodePolarSubscription,
} from "@repo/backend/confect/billing/polar/payload";
import { polarSubscriptionState } from "@repo/backend/confect/billing/polar/subscription";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { Effect, Match, Option } from "effect";

/**
 * Applies one Polar subscription to the billing model. The customer names the
 * account, the subscription names its row, and a state older than the stored one
 * is refused. A subscription that is still pending grants nothing; any other
 * state keeps its paid period as the grant's window.
 */
const applySubscriptionEvent = Effect.fn("billing.polar.applySubscription")(
  function* (data: unknown) {
    const decoded = yield* decodePolarSubscription(data).pipe(Effect.option);
    if (Option.isNone(decoded)) {
      return "invalid" as const;
    }
    const subscription = decoded.value;
    const account = yield* findAccountByProviderCustomer(
      "polar",
      subscription.customerId
    );
    if (Option.isNone(account)) {
      return "unknownCustomer" as const;
    }
    const state = polarSubscriptionState(account.value._id, subscription);
    if (Option.isNone(state)) {
      return "unsupported" as const;
    }
    const applied = yield* applySubscriptionState(state.value);
    if (applied.kind === "stale") {
      return "stale" as const;
    }
    if (
      state.value.status !== "pending" &&
      state.value.currentPeriodEnd !== null
    ) {
      yield* syncSubscriptionGrant(applied.subscriptionId);
    }
    return "applied" as const;
  }
);

/** Routes one Polar event to the subscription it changes. Events that change no subscription are ignored. */
const dispatch = (type: string, data: unknown) =>
  Match.value(type).pipe(
    Match.whenOr(
      "subscription.created",
      "subscription.updated",
      "subscription.active",
      "subscription.canceled",
      "subscription.past_due",
      "subscription.uncanceled",
      "subscription.revoked",
      () => applySubscriptionEvent(data)
    ),
    Match.orElse(() => Effect.succeed("ignored" as const))
  );

/**
 * Applies one stored Polar delivery to the billing model and says what it did.
 * A body that does not decode is reported and changes nothing. A customer Nakafa
 * holds no account for is reported as unknown, so a delivery for a deleted
 * account is acknowledged and changes nothing.
 */
export const processPolarEvent = Effect.fn("billing.polar.process")(function* (
  payload: string
) {
  const envelope = decodePolarEnvelope(payload);
  if (Option.isNone(envelope)) {
    return "invalid" as const;
  }
  return yield* dispatch(envelope.value.type, envelope.value.data);
});
