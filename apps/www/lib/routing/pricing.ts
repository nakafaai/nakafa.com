import type { NextRequest, NextResponse } from "next/server";
import {
  getProMonthlyPricing,
  pricingCountryHeaderName,
  pricingCurrencyCookieName,
  pricingCurrencyMaxAge,
} from "@/components/marketing/about/pricing/display";

/**
 * Sets the visitor's price currency as a first-party cookie, from the country
 * that the platform forwards. The pages are cached and do not read the country,
 * so the root script reads this cookie before the prices paint. The cookie is
 * written only when it is missing or holds another currency, so most visits set
 * nothing. It holds no secret, so the script can read it.
 */
export function writePricingCurrencyCookie(
  request: NextRequest,
  response: NextResponse
) {
  const { currency } = getProMonthlyPricing(
    request.headers.get(pricingCountryHeaderName)
  ).price;
  if (request.cookies.get(pricingCurrencyCookieName)?.value === currency) {
    return;
  }

  response.cookies.set(pricingCurrencyCookieName, currency, {
    httpOnly: false,
    maxAge: pricingCurrencyMaxAge,
    path: "/",
    sameSite: "lax",
  });
}
