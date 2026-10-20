import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr } from "effect";

/** Every IANA time zone that the platform knows, as the time zone choices of a unit. */
export const timeZoneItems = Arr.map(
  Intl.supportedValuesOf("timeZone"),
  (zone) => ({ label: zone, value: zone })
);

/** The content languages a unit may choose, from the platform's list of languages. */
export const languageItems = Arr.map(languages, (language) => ({
  label: language.label,
  value: language.value,
}));
