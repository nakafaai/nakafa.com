import { LocaleSchema } from "@repo/contents/_types/content";
import {
  PublicRouteSegmentSchema,
  PublicRouteSlugMapSchema,
} from "@repo/contents/_types/route/segment";
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

const TryoutTranslationMapSchema = Schema.Record({
  key: LocaleSchema,
  value: TryoutTranslationSchema,
});

export const TryoutScoringStrategySchema = Schema.Literal(
  "irt",
  "raw",
  "weighted"
);

export type TryoutScoringStrategy = SchemaType<
  typeof TryoutScoringStrategySchema
>;

export const TryoutSectionSourceSchema = Schema.Struct({
  key: TryoutKeySchema,
  order: Schema.Int.pipe(Schema.positive()),
  questionCount: Schema.Int.pipe(Schema.positive()),
  questionSourcePath: TryoutSourcePathSchema,
  routeSlugs: PublicRouteSlugMapSchema,
  translations: TryoutTranslationMapSchema,
});

export type TryoutSectionSource = SchemaType<typeof TryoutSectionSourceSchema>;
export type TryoutSectionSourceInput = SchemaEncoded<
  typeof TryoutSectionSourceSchema
>;

export const TryoutSetSourceSchema = Schema.Struct({
  key: TryoutKeySchema,
  order: Schema.Int.pipe(Schema.positive()),
  routeSlugs: PublicRouteSlugMapSchema,
  sections: Schema.Array(TryoutSectionSourceSchema),
  translations: TryoutTranslationMapSchema,
});

export type TryoutSetSource = SchemaType<typeof TryoutSetSourceSchema>;
export type TryoutSetSourceInput = SchemaEncoded<typeof TryoutSetSourceSchema>;

export const TryoutExamSourceSchema = Schema.Struct({
  countryCode: CountryCodeSchema,
  countryKey: TryoutKeySchema,
  countryRouteSlugs: PublicRouteSlugMapSchema,
  countryTranslations: TryoutTranslationMapSchema,
  examKey: TryoutKeySchema,
  examRouteSlugs: PublicRouteSlugMapSchema,
  examTranslations: TryoutTranslationMapSchema,
  scoringStrategy: TryoutScoringStrategySchema,
  sets: Schema.Array(TryoutSetSourceSchema),
  sourceRevision: PublicRouteSegmentSchema,
});

export type TryoutExamSource = SchemaType<typeof TryoutExamSourceSchema>;
export type TryoutExamSourceInput = SchemaEncoded<
  typeof TryoutExamSourceSchema
>;

/** Decodes one authored try-out exam source at module load time. */
export function defineTryoutExamSource(input: TryoutExamSourceInput) {
  return Schema.decodeUnknownSync(TryoutExamSourceSchema)(input);
}
