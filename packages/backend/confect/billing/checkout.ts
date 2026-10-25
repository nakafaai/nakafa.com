import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import {
  checkoutLocaleValidator,
  getPolarCheckoutLocale,
  polarCheckoutLocaleValidator,
} from "@repo/backend/confect/billing/locale";
import { proProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
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
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { Effect, Schema } from "effect";

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

/** Validates the redirect a caller controls before Polar is contacted. The success URL stays on the primary site. */
export const validateCheckoutRequest = Effect.fn(
  "billing.checkout.validateRequest"
)(function* (input: CheckoutRequestInput) {
  const siteUrl = yield* readSiteUrl();
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
  if (successUrl.origin !== siteUrl.origin) {
    return yield* invalidSuccessUrl(
      "Checkout success URL must stay on the primary site origin."
    );
  }
  return {
    locale: input.locale,
    polarLocale: getPolarCheckoutLocale(input.locale),
    productId: proProductIdFor(server),
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
