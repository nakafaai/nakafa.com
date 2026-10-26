import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { readBillingOverview } from "@repo/backend/confect/billing/overview";
import { readRecentPayments } from "@repo/backend/confect/billing/payments";
import spec from "@repo/backend/confect/billing/queries.spec";
import {
  checkoutCountryFor,
  routeOffer,
} from "@repo/backend/confect/billing/route";
import { ProCheckoutOffer } from "@repo/backend/confect/billing/spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** The viewer's plan, subscription, and Nina credits, read at the moment of the query. */
const overview = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("billing.queries.overview")(function* () {
    const { appUser } = yield* requireAuth();
    const now = yield* Clock.currentTimeMillis;
    return yield* readBillingOverview(appUser, now);
  })
);

/** The viewer's newest payments, their receipts, read at the moment of the query. */
const payments = FunctionImpl.make(
  databaseSchema,
  spec,
  "payments",
  Effect.fn("billing.queries.payments")(function* () {
    const { appUser } = yield* requireAuth();
    return yield* readRecentPayments(appUser._id);
  })
);

/**
 * The Pro offers sold in `currency`, each at its price on the rail that sells it
 * there, in catalog order. An offer no rail sells there is left out, so Polar's
 * Indonesia sells only the monthly plan, and Xendit's adds the passes.
 */
const proOffers = FunctionImpl.make(
  databaseSchema,
  spec,
  "proOffers",
  Effect.fn("billing.queries.proOffers")(function* ({ currency }) {
    const offers = yield* Effect.forEach(ProCheckoutOffer.literals, (offer) =>
      routeOffer(checkoutCountryFor(currency), offer).pipe(
        Effect.map((route) =>
          Option.some({
            offer,
            amount: route.amount,
            currency: route.currency,
            interval: billingOffer(offer).interval,
            months: billingOffer(offer).months,
          })
        ),
        Effect.catchTags({
          ConfigError: () => Effect.succeedNone,
          OfferUnavailable: () => Effect.succeedNone,
          XenditNotConfigured: () => Effect.succeedNone,
        })
      )
    );
    return Arr.getSomes(offers);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(overview),
  Layer.provide(payments),
  Layer.provide(proOffers),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
