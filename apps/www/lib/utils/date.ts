import { enUS, id } from "date-fns/locale";
import type { Locale } from "next-intl";

/** Map the active app locale to a date-fns locale object. */
export function getLocale(locale: Locale) {
  if (locale === "id") {
    return id;
  }

  return enUS;
}
