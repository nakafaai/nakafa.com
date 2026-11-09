/**
 * The one registry of the countries Nakafa is open in. Each country names the
 * currency its buyers and schools pay in, the language its new schools write
 * in, the zones they keep time in, the month their school year starts, and the
 * rail that takes their money. Consumer billing, School billing and the opening
 * of a school all read it, so no country is described twice. Browser code
 * imports this module, so it reads no secret and no server setting.
 */
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  BillingCurrency,
  BillingOfferRailSchema,
  billingEuroTerritoryCodes,
} from "@repo/backend/confect/billing/catalog";
import { NewTimeZone } from "@repo/backend/confect/tenancy/locale";
import { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, HashSet, Option, Schema } from "effect";

/** The countries Nakafa is open in. Any other country pays in euros or dollars through Polar. */
export const OpenCountry = Schema.Literals([
  "ID",
  "MY",
  "SG",
  "GB",
  "DE",
  "US",
]);
export type OpenCountry = typeof OpenCountry.Type;

/**
 * The levels of school that a country names by their own names, such as SMA in
 * Indonesia or SMK in Malaysia, or the stages every other country shares.
 */
const LevelNames = Schema.Literals(["national", "stage"]);

/** The stages a school outside a country with its own levels chooses from, each kept as the level it stands for. */
const SHARED_STAGES = [
  "paud",
  "sd",
  "smp",
  "sma",
  "smk",
  "slb",
  "other",
] as const;

/**
 * What one open country decides. `xendit` names the Indonesian rail, which its
 * own switch can move to Polar. `levels` are the levels a new school there
 * chooses from, and `levelNames` how they are named.
 */
export const CountryProfile = Schema.Struct({
  currency: BillingCurrency,
  levelNames: LevelNames,
  levels: Schema.NonEmptyArray(UnitLevel),
  /** The language a new school's pages start in, one Nakafa serves, so Malaysia starts in English until Malay is served. */
  locale: ActiveAppLocaleCodeSchema,
  rail: BillingOfferRailSchema,
  yearStart: Schema.Int.check(Schema.isBetween({ maximum: 12, minimum: 1 })),
  zones: Schema.NonEmptyArray(NewTimeZone),
});
type CountryProfile = typeof CountryProfile.Type;

/**
 * Every open country's profile, tested once for its rules. Singapore and the
 * United Kingdom pay in dollars until their own currency is priced: a country's
 * currency is always one the catalog sells in.
 */
export const countryProfiles = {
  DE: {
    levelNames: "stage",
    levels: SHARED_STAGES,
    currency: "EUR",
    locale: "de",
    rail: "polar",
    yearStart: 8,
    zones: ["Europe/Berlin"],
  },
  GB: {
    levelNames: "stage",
    levels: SHARED_STAGES,
    currency: "USD",
    locale: "en",
    rail: "polar",
    yearStart: 9,
    zones: ["Europe/London"],
  },
  ID: {
    levelNames: "national",
    levels: [
      "paud",
      "sd",
      "mi",
      "smp",
      "mts",
      "sma",
      "ma",
      "smk",
      "slb",
      "other",
    ],
    currency: "IDR",
    locale: "id",
    rail: "xendit",
    yearStart: 7,
    zones: ["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"],
  },
  MY: {
    levelNames: "national",
    levels: ["my-sk", "my-smk", "my-smka", "my-form6", "other"],
    currency: "MYR",
    locale: "en",
    rail: "polar",
    yearStart: 1,
    zones: ["Asia/Kuala_Lumpur", "Asia/Kuching"],
  },
  SG: {
    levelNames: "stage",
    levels: SHARED_STAGES,
    currency: "USD",
    locale: "en",
    rail: "polar",
    yearStart: 1,
    zones: ["Asia/Singapore"],
  },
  US: {
    levelNames: "stage",
    levels: SHARED_STAGES,
    currency: "USD",
    locale: "en",
    rail: "polar",
    yearStart: 8,
    zones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
    ],
  },
} as const satisfies Record<OpenCountry, CountryProfile>;

/** The profile of one country, or none when Nakafa is not open there. */
function countryProfileOf(country: string): Option.Option<CountryProfile> {
  return Schema.is(OpenCountry)(country)
    ? Option.some(countryProfiles[country])
    : Option.none();
}

/** The currency a buyer or a school in `country` pays in: its own, euros in a euro territory, dollars elsewhere. */
export function currencyOfCountry(country: string): BillingCurrency {
  return Option.match(countryProfileOf(country), {
    onNone: () =>
      HashSet.has(billingEuroTerritoryCodes, country) ? "EUR" : "USD",
    onSome: (profile) => profile.currency,
  });
}

/** The rail that takes the money of `country`: Xendit in Indonesia, Polar everywhere else. */
export function railOfCountry(country: string) {
  return Option.match(countryProfileOf(country), {
    onNone: () => "polar" as const,
    onSome: (profile) => profile.rail,
  });
}

/**
 * The one open country that pays in `currency`, or none when several do, as
 * dollars, or none does. A checkout that knows only the currency it showed
 * routes as that country.
 */
export function countryOfCurrency(
  currency: BillingCurrency
): Option.Option<OpenCountry> {
  const countries = Arr.filter(
    OpenCountry.literals,
    (country) => countryProfiles[country].currency === currency
  );
  return countries.length === 1 ? Arr.head(countries) : Option.none();
}
