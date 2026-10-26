import { FunctionSpec, GroupSpec } from "@confect/core";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { checkoutLocaleValidator } from "@repo/backend/confect/billing/locale";
import {
  PolarCheckoutErrorWire,
  PolarCustomerErrorWire,
  PolarDuplicateEmailErrorWire,
  PolarUpdateErrorWire,
} from "@repo/backend/confect/billing/polar/spec";
import {
  CheckoutOfferUnavailableWire,
  CheckoutSessionIoErrorWire,
  CheckoutUnavailable,
} from "@repo/backend/confect/billing/spec";
import { NotMember } from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The Polar School offers a school outside Indonesia buys seats on. */
const PolarSchoolOffer = Schema.Literals([
  "school.seat.month",
  "school.seat.year",
]);

/**
 * The Polar checkout of a school outside Indonesia (K47): its Owner or Admin buys
 * one seat per enrolled student not paid for yet, as a business, and returns to
 * the school's billing.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicAction({
    name: "checkout",
    args: () => ({
      locale: checkoutLocaleValidator,
      offer: PolarSchoolOffer,
      slug: TenantSlug,
    }),
    returns: () => Schema.Struct({ url: Schema.String }),
    error: () =>
      Schema.Union([
        AuthFailure,
        NotMember,
        AccessDenied,
        SiteConfigError,
        CheckoutSessionIoErrorWire,
        CheckoutUnavailable,
        CheckoutOfferUnavailableWire,
        PolarCustomerErrorWire,
        PolarDuplicateEmailErrorWire,
        PolarCheckoutErrorWire,
        PolarUpdateErrorWire,
      ]),
  }).middleware(Session)
);
