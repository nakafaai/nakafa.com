import { enUS, id } from "date-fns/locale";
import type { Locale } from "next-intl";

export function getLocale(locale: Locale) {
  switch (locale) {
    case "en":
      return enUS;
    case "id":
      return id;
    default:
      return enUS;
  }
}
