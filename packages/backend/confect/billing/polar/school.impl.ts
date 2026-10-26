import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { getPolarCheckoutLocale } from "@repo/backend/confect/billing/locale";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import { readPolarServer } from "@repo/backend/confect/billing/polar/client";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import spec from "@repo/backend/confect/billing/polar/school.spec";
import {
  CheckoutOfferUnavailable,
  checkoutOfferUnavailableCode,
  checkoutSessionIoError,
} from "@repo/backend/confect/billing/spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { Array as Arr, Effect, Layer, Option } from "effect";

/**
 * Starts the Polar checkout of a school's seats. The school's billing is read with
 * the caller's own identity, so only its Owner or Admin gets a checkout, and only
 * for an offer the school's rail sells. The checkout buys a seat for each enrolled
 * student the school does not pay for yet, through the caller's own Polar customer,
 * and names the school, which the subscription's webhook grants Pro to.
 */
const checkout = FunctionImpl.make(
  databaseSchema,
  spec,
  "checkout",
  Effect.fn("billing.polar.school.checkout")(function* ({
    locale,
    offer,
    slug,
  }) {
    const { appUser } = yield* requireAuth();
    const { runQuery } = yield* QueryRunner;
    const school = yield* runQuery(refs.public.billing.school.overview, {
      slug,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    const quote = Arr.findFirst(
      school.quotes,
      (candidate) => candidate.offer === offer
    );
    if (Option.isNone(quote)) {
      return yield* new CheckoutOfferUnavailable({
        code: checkoutOfferUnavailableCode,
        message: "This offer is not available here.",
      });
    }
    const server = yield* readPolarServer().pipe(Effect.orDie);
    const site = yield* readSiteUrl();
    const ctx = yield* ActionCtx;
    const requestMetadata = yield* Effect.tryPromise({
      try: () => ctx.meta.getRequestMetadata(),
      catch: checkoutSessionIoError,
    });
    const customerId = yield* ensureProviderCustomer(appUser._id);
    return yield* polarGateway.createCheckoutSession({
      customerId,
      customerIpAddress: requestMetadata.ip,
      locale: getPolarCheckoutLocale(locale),
      productIds: [polarProductIdFor(offer, server)],
      school: { seats: quote.value.seats, tenantId: school.tenantId },
      successUrl: new URL(`/school/${slug}/settings/billing`, site).href,
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(checkout),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
