import { HttpClient } from "@confect/js";
import billing from "@repo/backend/confect/_generated/refs/billing";
import {
  type BillingCurrency,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import { Array as Arr, Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";

/**
 * The Pro offers sold in the currency the page shows, read once when the learner
 * asks to buy, so no page pays for the read before then. A pass holder who
 * extends Pro is shown only the passes, since a plan cannot start on top of one.
 */
export const readProOffers = Effect.fn("www.billing.offers.read")(function* (
  currency: BillingCurrency,
  passesOnly: boolean
) {
  const offers = yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) =>
      client.query(billing.queries.proOffers, { currency })
    ),
    Effect.provide(httpLayer())
  );
  return passesOnly
    ? Arr.filter(offers, ({ offer }) => billingOffer(offer).interval === "pass")
    : offers;
});
