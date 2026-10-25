import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { latestPersonalGrant } from "@repo/backend/confect/billing/grants";
import {
  checkoutLocaleValidator,
  getPolarCheckoutLocale,
  polarCheckoutLocaleValidator,
} from "@repo/backend/confect/billing/locale";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { readPolarServer } from "@repo/backend/confect/billing/polar/client";
import {
  type PolarCheckoutError,
  PolarCheckoutError as PolarCheckoutFailure,
  polarCheckoutErrorCode,
} from "@repo/backend/confect/billing/polar/spec";
import {
  type BillingUrl,
  type CheckoutAdmission,
  type CheckoutRequestInput,
  type CheckoutSessionIoError,
  CheckoutUnavailable,
  InvalidCheckoutSuccessUrl,
  invalidCheckoutSuccessUrlCode,
} from "@repo/backend/confect/billing/spec";
import { readSiteUrls } from "@repo/backend/confect/site/config";
import { Array as Arr, Effect, Option, Schema } from "effect";

type CheckoutAdmissionUser = Parameters<typeof isAccountDeletionPending>[0];

const invalidSuccessUrl = (message: string) =>
  new InvalidCheckoutSuccessUrl({
    code: invalidCheckoutSuccessUrlCode,
    message,
  });

/** A checkout request once it is checked: the Pro product, the Polar language, and the return URL. */
const validCheckoutRequestValidator = Schema.Struct({
  locale: checkoutLocaleValidator,
  polarLocale: polarCheckoutLocaleValidator,
  productId: Schema.String,
  successUrl: Schema.String,
});

/** Validates the redirect a caller controls before Polar is contacted. The success URL stays on a site of this deployment. */
export const validateCheckoutRequest = Effect.fn(
  "billing.checkout.validateRequest"
)(function* (input: CheckoutRequestInput) {
  const sites = yield* readSiteUrls();
  const server = yield* readPolarServer().pipe(
    Effect.mapError(
      () =>
        new PolarCheckoutFailure({
          code: polarCheckoutErrorCode,
          message: "Failed to create checkout session.",
        })
    )
  );
  const successUrl = yield* Effect.try({
    try: () => new URL(input.successUrl),
    catch: () =>
      invalidSuccessUrl("Checkout success URL must be a valid absolute URL."),
  });
  if (!Arr.some(sites, (site) => site.origin === successUrl.origin)) {
    return yield* invalidSuccessUrl(
      "Checkout success URL must stay on a site of this deployment."
    );
  }
  return {
    locale: input.locale,
    polarLocale: getPolarCheckoutLocale(input.locale),
    productId: polarProductIdFor("pro.monthly", server),
    successUrl: input.successUrl,
  } satisfies typeof validCheckoutRequestValidator.Type;
});

/** Revalidates account access after Polar IO without gating sales on analytics. */
export const admitCheckoutProgram = Effect.fn("billing.checkout.admitCheckout")(
  function* <R>(operations: {
    readonly captureEvent: () => Effect.Effect<void, never, R>;
    readonly loadUser: () => Effect.Effect<
      CheckoutAdmissionUser | null,
      CheckoutSessionIoError,
      R
    >;
  }) {
    const user = yield* operations.loadUser();
    if (!user || isAccountDeletionPending(user)) {
      return { kind: "unavailable" } satisfies CheckoutAdmission;
    }
    yield* operations.captureEvent();
    return { kind: "admitted" } satisfies CheckoutAdmission;
  }
);

/**
 * Returns the Polar checkout only if the account is still admitted once Polar has
 * answered. A deletion that starts during the Polar call withholds the checkout.
 */
export const createAdmittedCheckoutSession = Effect.fn(
  "billing.checkout.createAdmittedSession"
)(function* (operations: {
  readonly admitCheckout: Effect.Effect<
    CheckoutAdmission,
    CheckoutSessionIoError
  >;
  readonly createCheckout: Effect.Effect<BillingUrl, PolarCheckoutError>;
}) {
  const checkout = yield* operations.createCheckout;
  const admission = yield* operations.admitCheckout;
  if (admission.kind === "unavailable") {
    return yield* new CheckoutUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return checkout;
});

/** The billing rails a user's personal account can pay through. */
const PERSONAL_RAILS = ["polar", "xendit"] as const;

/** The statuses of a Pro subscription that still holds Pro, or still owes its payment. */
const PRO_HOLDING_STATUSES = ["active", "pastDue"] as const;

/**
 * Whether one user already holds Pro: a personal Pro grant that runs at `now`, or a
 * personal Pro subscription that is active or past due on either rail. Such a user
 * manages the plan in the customer portal, so no second checkout starts for them.
 */
export const holdsPro = Effect.fn("billing.checkout.holdsPro")(function* (
  userId: Docs["users"]["_id"],
  now: number
) {
  if (Option.isSome(yield* latestPersonalGrant(userId, now))) {
    return true;
  }
  const reader = yield* DatabaseReader;
  const accounts = yield* Effect.forEach(PERSONAL_RAILS, (rail) =>
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
        return true;
      }
    }
  }
  return false;
});
