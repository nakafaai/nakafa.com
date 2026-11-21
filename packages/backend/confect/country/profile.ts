/**
 * The schema of one open country's profile in `country/registry.ts`. It lives
 * apart from the registry, which every page loads for its price currency, because
 * it reads the schemas of a school's levels and time zones, which only a school
 * page and the server need. The registry's test holds every profile to it.
 */
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  BillingCurrency,
  BillingOfferRailSchema,
} from "@repo/backend/confect/billing/catalog";
import { NewTimeZone } from "@repo/backend/confect/tenancy/locale";
import { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The levels of school that a country names by their own names, such as SMA in
 * Indonesia or SMK in Malaysia, or the stages every other country shares.
 */
const LevelNames = Schema.Literals(["national", "stage"]);

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
export type CountryProfile = typeof CountryProfile.Type;
