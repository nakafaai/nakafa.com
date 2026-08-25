import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { NakafaAgentReadableContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema, Struct } from "effect";
/** Runtime schema for Quran reference input. */
export const NakafaAgentQuranReferenceOptionsSchema = Schema.Struct({
  from_verse: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0)),
    Schema.withDecodingDefaultType(Effect.succeed(1))
  ).annotate({
    default: 1,
    description: "First verse number to include.",
  }),
  include_tafsir: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ).annotate({
    default: false,
    description:
      "Whether to include the published tafsir text for the requested locale when available.",
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
        { minimum: 1, maximum: QURAN_SURAH_COUNT },
        {
          message: `Surah number must be between 1 and ${QURAN_SURAH_COUNT}.`,
        }
      )
    )
  ).annotate({
    description: "Surah number.",
  }),
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
  .annotate({ description: "Nakafa Quran reference options." });
/** Runtime schema for one Quran verse returned to agents. */
const NakafaAgentQuranVerseSchema = Schema.Struct({
  arabic: Schema.String.annotate({
    description: "Arabic Quran verse text.",
  }),
  number: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ).annotate({
    description: "Verse number inside the surah.",
  }),
  tafsir: Schema.optional(
    Schema.String.annotate({
      description: "Optional published tafsir text.",
    })
  ),
  translation: Schema.String.annotate({
    description: "Selected translation text.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa Quran verse reference." });
/** Runtime schema for Quran reference output. */
export const NakafaAgentQuranReferenceSchema =
  NakafaAgentReadableContentRefSchema.mapFields(
    (fields) => ({
      ...fields,
      name: Schema.String.annotate({
        description: "Source-authenticated transliterated surah name.",
      }),
      revelation: Schema.String.annotate({
        description: "Source-authenticated revelation place.",
      }),
      translation: Schema.String.annotate({
        description: "Source-authenticated surah name translation.",
      }),
      verses: Schema.Array(NakafaAgentQuranVerseSchema)
        .pipe(Schema.mutable, Schema.check(Schema.isMinLength(1)))
        .annotate({ description: "Bounded Quran verses." }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .annotate({ description: "Nakafa Quran reference result." });
export type NakafaAgentQuranReferenceOptions = Schema.Codec.Encoded<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
export type NakafaAgentQuranReference = Schema.Schema.Type<
  typeof NakafaAgentQuranReferenceSchema
>;
