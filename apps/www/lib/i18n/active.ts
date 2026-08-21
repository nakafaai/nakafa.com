import {
  type PublicAppLocale,
  routing,
} from "@repo/internationalization/src/routing";
import { hasLocale } from "next-intl";

/** Narrows one locale to the product's current public route set. */
export function isActiveLocale(locale: string): locale is PublicAppLocale {
  return hasLocale(routing.locales, locale);
}
