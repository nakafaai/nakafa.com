"use server";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { fetchAction, fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { env } from "@/env";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";

class BillingGatewayError extends Schema.TaggedError<BillingGatewayError>()(
  "BillingGatewayError",
  {
    cause: Schema.Unknown,
    operation: Schema.Literals([
      "read-subscription",
      "create-checkout",
      "create-portal",
    ]),
  }
) {}

const resolveBillingUrl = Effect.fn("www.pricing.resolveBillingUrl")(function* (
  locale: PublicAppLocale,
  token: string
) {
  const hasSubscription = yield* Effect.tryPromise({
    try: () =>
      fetchQuery(
        api.subscriptions.queries.hasActiveSubscription,
        { productId: products.pro.id },
        { token }
      ),
    catch: (cause) =>
      new BillingGatewayError({ cause, operation: "read-subscription" }),
  });

  if (hasSubscription) {
    const { url } = yield* Effect.tryPromise({
      try: () =>
        fetchAction(
          api.customers.actions.public.generateCustomerPortalUrl,
          {},
          { token }
        ),
      catch: (cause) =>
        new BillingGatewayError({ cause, operation: "create-portal" }),
    });

    return url;
  }

  const successUrl = new URL(`/${locale}/pricing`, env.SITE_URL).toString();
  const { url } = yield* Effect.tryPromise({
    try: () =>
      fetchAction(
        api.customers.actions.public.generateCheckoutLink,
        { locale, successUrl },
        { token }
      ),
    catch: (cause) =>
      new BillingGatewayError({ cause, operation: "create-checkout" }),
  });

  return url;
});

/** Opens checkout or the customer portal for the current authenticated user. */
export async function openBilling() {
  const locale = await getLocale();

  if (!isActiveLocale(locale)) {
    notFound();
  }

  const token = await getToken();

  if (!token) {
    const callbackPath = `/${locale}/pricing`;
    redirect(`/${locale}/auth?redirect=${encodeURIComponent(callbackPath)}`);
  }

  const url = await Effect.runPromise(resolveBillingUrl(locale, token));
  redirect(url);
}
