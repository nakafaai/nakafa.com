import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr } from "effect";

const languageMetadata = {
  de: {
    countryCode: "DE",
    label: "Deutsch (Deutschland)",
  },
  en: {
    countryCode: "GB",
    label: "English",
  },
  id: {
    countryCode: "ID",
    label: "Indonesia",
  },
} satisfies {
  readonly [Key in ActiveAppLocaleCode]: {
    readonly countryCode: string;
    readonly label: string;
  };
};

/**
 * The active locale codes as a plain readonly array. Mapping the tuple itself
 * would infer a non-empty tuple for `languages`, which changes its exported type.
 */
const localeCodes: readonly ActiveAppLocaleCode[] = ACTIVE_APP_LOCALE_CODES;

/** Language options derived from every canonical Nakafa locale. */
export const languages = Arr.map(localeCodes, (value) => ({
  ...languageMetadata[value],
  value,
}));
