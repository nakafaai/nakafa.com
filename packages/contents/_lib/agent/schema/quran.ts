import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Schema } from "effect";

/** Runtime schema for Quran reference input. */
export const NakafaAgentQuranReferenceOptionsSchema = Schema.Struct({
  from_verse: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ).annotations({ description: "First verse number to include." }),
  include_tafsir: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }).annotations({
    description:
      "Whether to include concise tafsir text for the requested locale when available.",
  }),
  locale: Schema.optionalWith(LocaleSchema, {
    default: () => routing.defaultLocale,
  }).annotations({ description: "Translation locale." }),
  surah: Schema.Number.pipe(Schema.int(), Schema.between(1, 114)).annotations({
    description: "Surah number.",
  }),
  to_verse: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
      description: "Last verse number to include; defaults to from_verse.",
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa Quran reference options." });

/** Runtime schema for one Quran verse returned to agents. */
const NakafaAgentQuranVerseSchema = Schema.Struct({
  arabic: Schema.String.annotations({
    description: "Arabic Quran verse text.",
  }),
  number: Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
    description: "Verse number inside the surah.",
  }),
  tafsir: Schema.optional(
    Schema.String.annotations({ description: "Optional concise tafsir text." })
  ),
  translation: Schema.String.annotations({
    description: "Selected translation text.",
  }),
  transliteration: Schema.String.annotations({
    description: "Latin transliteration text.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa Quran verse reference." });

/** Runtime schema for Quran reference output. */
export const NakafaAgentQuranReferenceSchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      name: Schema.String.annotations({
        description: "Localized surah display name.",
      }),
      revelation: Schema.String.annotations({
        description: "Localized revelation place.",
      }),
      translation: Schema.String.annotations({
        description: "Localized surah name translation.",
      }),
      verses: Schema.Array(NakafaAgentQuranVerseSchema)
        .pipe(Schema.minItems(1), Schema.mutable)
        .annotations({ description: "Bounded Quran verses." }),
    })
  ),
  Schema.mutable
).annotations({ description: "Nakafa Quran reference result." });

export type NakafaAgentQuranReferenceOptions = Schema.Schema.Encoded<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
export type NakafaAgentQuranReference = Schema.Schema.Type<
  typeof NakafaAgentQuranReferenceSchema
>;
