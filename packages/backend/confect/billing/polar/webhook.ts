import {
  DatabaseReader,
  DocumentIds,
} from "@repo/backend/confect/_generated/services";
import { findAccountByProviderCustomer } from "@repo/backend/confect/billing/accounts";
import type { BillingOfferKey } from "@repo/backend/confect/billing/catalog";
import { endSubscriptionGrant } from "@repo/backend/confect/billing/grantEnd";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import { applyPolarOrder } from "@repo/backend/confect/billing/polar/order";
import type { PolarSubscriptionSource } from "@repo/backend/confect/billing/polar/payload";
import {
  decodePolarEnvelope,
  decodePolarSubscription,
} from "@repo/backend/confect/billing/polar/payload";
import {
  polarGrantAction,
  polarSchoolOf,
  polarStateOf,
  polarSubscriptionState,
} from "@repo/backend/confect/billing/polar/subscription";
import {
  ensureSchoolAccount,
  schoolRail,
} from "@repo/backend/confect/billing/school";
import {
  applySubscriptionState,
  type BillingSubscriptionState,
} from "@repo/backend/confect/billing/subscriptions";
import { Clock, Effect, Match, Option } from "effect";

/**
 * Writes one mapped state and moves its grant with it (see `polarGrantAction`).
 * A state older than the stored one is refused.
 */
const applyState = Effect.fn("billing.polar.applyState")(function* (
  state: BillingSubscriptionState,
  subscription: PolarSubscriptionSource
) {
  const applied = yield* applySubscriptionState(state);
  if (applied.kind === "stale") {
    return "stale" as const;
  }
  const action = polarGrantAction(subscription, yield* Clock.currentTimeMillis);
  if (action.kind === "endAt") {
    yield* endSubscriptionGrant(applied.subscriptionId, action.endsAt);
  } else if (state.currentPeriodEnd !== null) {
    yield* syncSubscriptionGrant(applied.subscriptionId);
  }
  return "applied" as const;
});

/**
 * Applies a School seat subscription to the school its checkout named, on the
 * school's Polar account, so its enrolled students hold Pro while it runs. A school
 * that is gone, or that pays through Xendit, is logged and changes nothing.
 */
const applySchoolState = Effect.fn("billing.polar.applySchool")(function* (
  school: { readonly offer: BillingOfferKey; readonly tenantId: string },
  subscription: PolarSubscriptionSource
) {
  const tenantId = yield* (yield* DocumentIds).parse(
    "tenants",
    school.tenantId
  );
  const tenant = Option.isNone(tenantId)
    ? null
    : yield* (yield* DatabaseReader)
        .table("tenants")
        .get(tenantId.value)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
  if (tenant === null || schoolRail(tenant.country) !== "polar") {
    yield* Effect.logError("Polar School subscription names no Polar school", {
      subscriptionId: subscription.id,
    });
    return "unsupported" as const;
  }
  const accountId = yield* ensureSchoolAccount(tenant);
  return yield* applyState(
    polarStateOf(accountId, subscription, school.offer),
    subscription
  );
});

/**
 * Applies one Polar subscription to the billing model, for a webhook and for the
 * reconciliation of listed subscriptions alike. The customer names the account,
 * the subscription names its row, and a state older than the stored one is refused.
 * The grant follows the status (see `polarGrantAction`). A subscription whose
 * product Nakafa does not sell is logged as an error and changes nothing.
 */
export const applyPolarSubscription = Effect.fn(
  "billing.polar.applySubscription"
)(function* (data: unknown) {
  const decoded = yield* decodePolarSubscription(data).pipe(Effect.option);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  const subscription = decoded.value;
  const school = polarSchoolOf(subscription);
  if (Option.isSome(school)) {
    return yield* applySchoolState(school.value, subscription);
  }
  const account = yield* findAccountByProviderCustomer(
    "polar",
    subscription.customerId
  );
  if (Option.isNone(account)) {
    return {
      kind: "unknownCustomer" as const,
      customerId: subscription.customerId,
    };
  }
  const state = polarSubscriptionState(account.value._id, subscription);
  if (Option.isNone(state)) {
    yield* Effect.logError(
      "Polar subscription is not a Pro offer Nakafa sells",
      {
        productId: subscription.productId,
        recurringInterval: subscription.recurringInterval,
        status: subscription.status,
        subscriptionId: subscription.id,
      }
    );
    return "unsupported" as const;
  }
  return yield* applyState(state.value, subscription);
});

/** Routes one Polar event to the row it changes. Events that change no subscription or pack are ignored. */
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
      () => applyPolarSubscription(data)
    ),
    Match.when("order.paid", () => applyPolarOrder(data, "paid")),
    Match.when("order.refunded", () => applyPolarOrder(data, "refunded")),
    Match.orElse(() => Effect.succeed("ignored" as const))
  );

/**
 * Applies one stored Polar delivery to the billing model and says what it did.
 * A body that does not decode is reported and changes nothing. A customer Nakafa
 * holds no account for is returned as unknown, so the caller can resolve it.
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
