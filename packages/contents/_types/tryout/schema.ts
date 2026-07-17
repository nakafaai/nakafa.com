import {
  PublicRouteSegmentSchema,
  PublicRouteSlugMapSchema,
} from "@repo/contents/_types/route/segment";
import { fieldsForEveryLocale } from "@repo/utilities/locales";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const TRYOUT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const TRYOUT_SOURCE_PATH_PATTERN =
  /^question-bank\/tryout\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const TryoutKeySchema = Schema.String.pipe(
  Schema.pattern(TRYOUT_KEY_PATTERN, {
    identifier: "TryoutKey",
    description: "Lowercase kebab-case try-out source key segment.",
    message: () => "Invalid try-out key.",
  })
);

export type TryoutKey = SchemaType<typeof TryoutKeySchema>;

/** Stable route kinds owned by the try-out catalog. */
export const TRYOUT_ROUTE_KIND_VALUES = [
  "tryout-country",
  "tryout-exam",
  "tryout-track",
  "tryout-set",
  "tryout-section",
] as const;

/** Runtime schema for try-out route projection kinds. */
export const TryoutRouteKindSchema = Schema.Literal(
  ...TRYOUT_ROUTE_KIND_VALUES
);

/** Try-out route projection kind derived from the runtime schema. */
export type TryoutRouteKind = SchemaType<typeof TryoutRouteKindSchema>;

export const CountryCodeSchema = Schema.String.pipe(
  Schema.pattern(COUNTRY_CODE_PATTERN, {
    identifier: "CountryCode",
    description: "Uppercase ISO 3166-1 alpha-2 country code.",
    message: () => "Invalid country code.",
  })
);

export type CountryCode = SchemaType<typeof CountryCodeSchema>;

export const TryoutSourcePathSchema = Schema.String.pipe(
  Schema.pattern(TRYOUT_SOURCE_PATH_PATTERN, {
    identifier: "TryoutSourcePath",
    description: "Question-bank source path rooted at question-bank/tryout.",
    message: () => "Invalid try-out question source path.",
  })
);

export type TryoutSourcePath = SchemaType<typeof TryoutSourcePathSchema>;

const TryoutTranslationSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

const TryoutTranslationMapSchema = Schema.Struct(
  fieldsForEveryLocale(TryoutTranslationSchema)
);

export const TryoutScoringStrategySchema = Schema.Literal(
  "irt",
  "raw",
  "weighted"
);

export type TryoutScoringStrategy = SchemaType<
  typeof TryoutScoringStrategySchema
>;

export const TryoutTrackKindSchema = Schema.Literal("subject", "year");

export type TryoutTrackKind = SchemaType<typeof TryoutTrackKindSchema>;

export const TryoutSectionVisibilitySchema = Schema.Literal(
  "internal-entry",
  "visible"
);

export type TryoutSectionVisibility = SchemaType<
  typeof TryoutSectionVisibilitySchema
>;

export const TryoutSectionSourceSchema = Schema.Struct({
  key: TryoutKeySchema,
  order: Schema.Int.pipe(Schema.positive()),
  questionCount: Schema.Int.pipe(Schema.positive()),
  questionSourcePath: TryoutSourcePathSchema,
  routeSlugs: PublicRouteSlugMapSchema,
  timeLimitSeconds: Schema.Int.pipe(Schema.positive()),
  translations: TryoutTranslationMapSchema,
  visibility: Schema.optionalWith(TryoutSectionVisibilitySchema, {
    default: () => "visible" as const,
  }),
});

export type TryoutSectionSource = SchemaType<typeof TryoutSectionSourceSchema>;
export type TryoutSectionSourceInput = SchemaEncoded<
  typeof TryoutSectionSourceSchema
>;

const TryoutSetSourceFieldsSchema = Schema.Struct({
  key: TryoutKeySchema,
  order: Schema.Int.pipe(Schema.positive()),
  routeSlugs: PublicRouteSlugMapSchema,
  sections: Schema.Array(TryoutSectionSourceSchema),
  translations: TryoutTranslationMapSchema,
});

export const TryoutSetSourceSchema = TryoutSetSourceFieldsSchema.pipe(
  Schema.filter(hasReachableTryoutSections, {
    message: () =>
      "Internal-entry try-out sections must be the only section in a set.",
  })
);

export type TryoutSetSource = SchemaType<typeof TryoutSetSourceSchema>;
export type TryoutSetSourceInput = SchemaEncoded<typeof TryoutSetSourceSchema>;

export const TryoutTrackSourceSchema = Schema.Struct({
  key: TryoutKeySchema,
  kind: TryoutTrackKindSchema,
  order: Schema.Int.pipe(Schema.positive()),
  routeSlugs: PublicRouteSlugMapSchema,
  sets: Schema.Array(TryoutSetSourceSchema),
  translations: TryoutTranslationMapSchema,
});

export type TryoutTrackSource = SchemaType<typeof TryoutTrackSourceSchema>;
export type TryoutTrackSourceInput = SchemaEncoded<
  typeof TryoutTrackSourceSchema
>;

export const TryoutExamSourceSchema = Schema.Struct({
  countryCode: CountryCodeSchema,
  countryKey: TryoutKeySchema,
  countryRouteSlugs: PublicRouteSlugMapSchema,
  countryTranslations: TryoutTranslationMapSchema,
  examKey: TryoutKeySchema,
  examRouteSlugs: PublicRouteSlugMapSchema,
  examTranslations: TryoutTranslationMapSchema,
  scoringStrategy: TryoutScoringStrategySchema,
  sourceRevision: PublicRouteSegmentSchema,
  tracks: Schema.Array(TryoutTrackSourceSchema),
});

export type TryoutExamSource = SchemaType<typeof TryoutExamSourceSchema>;
export type TryoutExamSourceInput = SchemaEncoded<
  typeof TryoutExamSourceSchema
>;

/** Require each set to expose sections or one internal direct-entry section. */
function hasReachableTryoutSections(source: {
  sections: readonly { visibility: TryoutSectionVisibility }[];
}) {
  const internalEntryCount = source.sections.filter(
    (section) => section.visibility === "internal-entry"
  ).length;

  if (internalEntryCount === 0) {
    return true;
  }

  return internalEntryCount === 1 && source.sections.length === 1;
}

/** Decodes one authored try-out exam source at module load time. */
export function defineTryoutExamSource(input: TryoutExamSourceInput) {
  return Schema.decodeUnknownSync(TryoutExamSourceSchema)(input);
}
