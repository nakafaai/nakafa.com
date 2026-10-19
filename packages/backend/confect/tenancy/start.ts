import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { NewCurrency, NewTimeZone } from "@repo/backend/confect/tenancy/locale";
import {
  SchoolName,
  TenantName,
  UnitLevel,
  UnitName,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * The countries an account can open a school in by itself. A school in another
 * country opens through Nakafa staff with a contract (K9).
 */
export const StartCountry = Schema.Literals(["ID", "SG", "GB", "DE", "US"]);

/**
 * The role the founder takes besides Owner, so the school's home fits them from
 * the first visit. A foundation's owner takes Owner alone.
 */
export const StartRole = Schema.Literals([
  "principal",
  "teacher",
  "admin",
  "foundation",
]);

/** How many students the school has, which the plan it is offered follows. */
export const SchoolSize = Schema.Literals(["s", "m", "l", "xl"]);

/**
 * The levels a new school teaches, one unit each, every level at most once. A
 * draft may hold none while the founder changes their mind; the opening needs
 * at least one unit.
 */
const StartLevels = Schema.Array(UnitLevel).check(Schema.isUnique());

/**
 * What a new school takes from its country: the currency of its plan, the
 * language of its content, the zones its schools keep time in with the first as
 * the default, and the month its school year starts.
 */
export const CountryDefaults = Schema.Struct({
  contentLanguage: AppLocaleCodeSchema,
  currency: NewCurrency,
  yearStart: Schema.Int.check(Schema.isBetween({ maximum: 12, minimum: 1 })),
  zones: Schema.NonEmptyArray(NewTimeZone),
});

/** Each country's defaults, read where a school is opened and tested once for its rules. */
export const countryDefaults = {
  DE: {
    contentLanguage: "de",
    currency: "EUR",
    yearStart: 8,
    zones: ["Europe/Berlin"],
  },
  GB: {
    contentLanguage: "en",
    currency: "GBP",
    yearStart: 9,
    zones: ["Europe/London"],
  },
  ID: {
    contentLanguage: "id",
    currency: "IDR",
    yearStart: 7,
    zones: ["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"],
  },
  SG: {
    contentLanguage: "en",
    currency: "SGD",
    yearStart: 1,
    zones: ["Asia/Singapore"],
  },
  US: {
    contentLanguage: "en",
    currency: "USD",
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
} as const satisfies Record<
  typeof StartCountry.Type,
  typeof CountryDefaults.Type
>;

/**
 * The zone a new school keeps time in: the browser's own zone when the country
 * uses it, such as `Asia/Makassar` for a school in Makassar, else the country's
 * first zone. The Owner changes it in the school's settings.
 */
export const startZone = (
  country: typeof StartCountry.Type,
  browserZone: string
) => {
  const { zones } = countryDefaults[country];
  return Option.getOrElse(
    Arr.findFirst(zones, (zone) => zone === browserZone),
    () => Arr.headNonEmpty(zones)
  );
};

/** One answer of the questionnaire, saved as the founder moves to the next question. */
export const StartAnswer = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("name"),
    name: SchoolName,
    slug: TenantSlug,
  }),
  Schema.Struct({ kind: Schema.Literal("country"), value: StartCountry }),
  Schema.Struct({ kind: Schema.Literal("levels"), value: StartLevels }),
  Schema.Struct({ kind: Schema.Literal("role"), value: StartRole }),
  Schema.Struct({ kind: Schema.Literal("size"), value: SchoolSize }),
]);

/** The draft fields one answer sets: the name answer sets the name and its address together. */
export const answerFields = (answer: typeof StartAnswer.Type) =>
  Match.value(answer).pipe(
    Match.discriminatorsExhaustive("kind")({
      country: ({ value }) => ({ country: value }),
      levels: ({ value }) => ({ levels: value }),
      name: ({ name, slug }) => ({ name, slug }),
      role: ({ value }) => ({ role: value }),
      size: ({ value }) => ({ size: value }),
    })
  );

/** The answers an account has saved so far, so the questionnaire resumes where it stopped. */
export const StartDraft = Schema.Struct({
  country: Schema.optionalKey(StartCountry),
  levels: Schema.optionalKey(StartLevels),
  name: Schema.optionalKey(TenantName),
  role: Schema.optionalKey(StartRole),
  size: Schema.optionalKey(SchoolSize),
  slug: Schema.optionalKey(TenantSlug),
  updatedAt: Schema.Finite,
});

/**
 * Every answer the school opens with. The units carry the names the founder saw,
 * written in the founder's language, and the time zone is the browser's.
 */
export const startArgs = {
  country: StartCountry,
  name: SchoolName,
  role: StartRole,
  size: SchoolSize,
  slug: TenantSlug,
  timeZone: Schema.String.check(Schema.isMaxLength(64)),
  units: Schema.NonEmptyArray(
    Schema.Struct({ level: UnitLevel, name: UnitName })
  ).check(
    Schema.makeFilter(
      (units) =>
        Arr.dedupe(Arr.map(units, (unit) => unit.level)).length ===
          units.length || "Each level opens one school."
    )
  ),
};
/** The answers of one opening, as the questionnaire sends them. */
export const StartRequest = Schema.Struct(startArgs);

/** Whether an address can name a new school, as the questionnaire shows it while the founder types. */
export const AddressState = Schema.Literals([
  "free",
  "taken",
  "reserved",
  "invalid",
]);
