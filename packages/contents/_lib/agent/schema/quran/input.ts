import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema, Struct } from "effect";

/** Runtime schema for Quran passage input. */
export const NakafaAgentQuranReferenceOptionsSchema = Schema.Struct({
  from_verse: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0)),
    Schema.withDecodingDefaultType(Effect.succeed(1))
  ).annotate({ default: 1, description: "First verse number to include." }),
  include_tafsir: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ).annotate({
    default: false,
    description:
      "Whether to include published tafsir text when the locale has an embedded edition.",
  }),
  locale: LocaleSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(routing.defaultLocale))
  ).annotate({
    default: routing.defaultLocale,
    description: "Translation locale.",
  }),
  surah: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(
      Schema.isBetween(
        { minimum: 1, maximum: 114 },
        { message: "Surah number must be between 1 and 114." }
      )
    )
  ).annotate({ description: "Surah number." }),
  to_verse: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ).annotate({
      description: "Last verse number to include; defaults to from_verse.",
    })
  ),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa Quran passage options." });

export type NakafaAgentQuranReferenceOptions = Schema.Codec.Encoded<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
export type NakafaAgentQuranReferenceInput = Schema.Schema.Type<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
