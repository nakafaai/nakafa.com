"use server";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { Locale } from "@repo/utilities/locales";
import { ipAddress } from "@vercel/functions";
import { headers } from "next/headers";
import { fetchAuthAction, requireAuth } from "@/lib/auth/server";

interface ProCheckoutInput {
  readonly locale: Locale;
  readonly successUrl: string;
}

/**
 * Creates a Polar Pro checkout URL from the current request context.
 *
 * Polar uses `customerIpAddress` to derive country, tax, and currency when a
 * checkout session is created by a backend instead of a customer-facing link.
 *
 * References:
 * - https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions
 * - https://polar.sh/docs/features/checkout/session
 */
export async function createProCheckoutUrl({
  locale,
  successUrl,
}: ProCheckoutInput) {
  await requireAuth();

  const requestHeaders = await headers();
  const customerIpAddress = ipAddress(requestHeaders) ?? null;
  const result = await fetchAuthAction(
    api.customers.actions.public.generateCheckoutLink,
    {
      customerIpAddress,
      locale,
      productIds: [products.pro.id],
      successUrl,
    }
  );

  return result.url;
}
