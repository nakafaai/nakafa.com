import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr } from "effect";

/**
 * Each declared language named in itself, so a reader finds their own language
 * whatever language the page is in.
 */
const languageLabels = {
  de: "Deutsch",
  en: "English",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
} satisfies Record<AppLocaleCode, string>;

/**
 * The country whose flag stands beside each language in every language menu:
 * the country Nakafa serves that language for, as an ISO 3166 code.
 */
const languageCountries = {
  de: "DE",
  en: "GB",
  id: "ID",
  ms: "MY",
} as const satisfies Record<AppLocaleCode, string>;

/**
 * The active locale codes as a plain readonly array. Mapping the tuple itself
 * would infer a non-empty tuple for `languages`, which changes its exported type.
 */
const localeCodes: readonly ActiveAppLocaleCode[] = ACTIVE_APP_LOCALE_CODES;

/** The languages Nakafa serves, each named in itself, with the country of its flag. */
export const languages = Arr.map(localeCodes, (value) => ({
  country: languageCountries[value],
  label: languageLabels[value],
  value,
}));
