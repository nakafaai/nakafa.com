import { locales } from "@repo/utilities/locales";
import { literals } from "convex-helpers/validators";

export const checkoutLocaleValidator = literals(...locales);

/**
 * Polar's documented checkout fallback language.
 *
 * Indonesian is not in Polar's supported checkout language list yet, so the
 * app locale is validated separately and Polar receives its documented default.
 *
 * References:
 * - https://polar.sh/docs/features/checkout/localization
 * - https://polar.sh/docs/api-reference/checkouts/create-session
 */
export const polarCheckoutDefaultLocale = "en";
export const polarCheckoutLocaleValidator = literals(
  polarCheckoutDefaultLocale
);
export type PolarCheckoutLocale = typeof polarCheckoutDefaultLocale;
