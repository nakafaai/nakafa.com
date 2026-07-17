import { type Locale, locales } from "@repo/utilities/locales";

const languageMetadata = {
  en: {
    countryCode: "GB",
    label: "English",
  },
  id: {
    countryCode: "ID",
    label: "Indonesia",
  },
} satisfies {
  readonly [Key in Locale]: {
    readonly countryCode: string;
    readonly label: string;
  };
};

/** Language options derived from every canonical Nakafa locale. */
export const languages = locales.map((value) => ({
  ...languageMetadata[value],
  value,
}));
