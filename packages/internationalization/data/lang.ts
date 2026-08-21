import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";

const languageMetadata = {
  de: {
    countryCode: "DE",
    label: "Deutsch",
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

/** Language options derived from every canonical Nakafa locale. */
export const languages = ACTIVE_APP_LOCALE_CODES.map((value) => ({
  ...languageMetadata[value],
  value,
}));
