import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Option } from "effect";

/** Narrows one locale to the product's current public route set. */
export function isActiveLocale(locale: string): locale is ActiveAppLocaleCode {
  return Option.isSome(decodeLocale(locale));
}
