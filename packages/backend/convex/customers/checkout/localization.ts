import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const checkoutLocaleValidator = literals(...ACTIVE_APP_LOCALE_CODES);

/**
 * Maps each Nakafa locale to a checkout language supported by Polar.
 *
 * German is supported directly. Indonesian is not supported yet, so it uses
 * Polar's documented English default without changing Nakafa's app locale.
 *
 * References:
 * - https://polar.sh/docs/features/checkout/localization
 * - https://polar.sh/docs/api-reference/checkouts/create-session
 */
export const polarCheckoutLocaleValidator = literals("de", "en");
export type PolarCheckoutLocale = Infer<typeof polarCheckoutLocaleValidator>;

const polarLocaleByAppLocale = {
  de: "de",
  en: "en",
  id: "en",
} satisfies Record<ActiveAppLocaleCode, PolarCheckoutLocale>;

/** Returns the supported Polar checkout language for one Nakafa locale. */
export function getPolarCheckoutLocale(locale: ActiveAppLocaleCode) {
  return polarLocaleByAppLocale[locale];
}
