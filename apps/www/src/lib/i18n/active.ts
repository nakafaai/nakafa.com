import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { LOCALES } from "@repo/internationalization/src/locale";
import { hasLocale } from "use-intl/core";

/** Narrows one locale to the product's current public route set. */
export function isActiveLocale(locale: string): locale is ActiveAppLocaleCode {
  return hasLocale(LOCALES, locale);
}
