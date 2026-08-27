import { NakafaAgentReadableContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { Schema, Struct } from "effect";

const NakafaAgentQuranPredecessorVerseSchema = Schema.Struct({
  arabic: Schema.String,
  number: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  tafsir: Schema.optional(Schema.String),
  translation: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Immutable Quran response retained only for the predecessor public route. */
export const NakafaAgentQuranPredecessorSchema =
  NakafaAgentReadableContentRefSchema.mapFields(
    (fields) => ({
      ...fields,
      name: Schema.String,
      revelation: Schema.String,
      translation: Schema.String,
      verses: Schema.Array(NakafaAgentQuranPredecessorVerseSchema).pipe(
        Schema.mutable,
        Schema.check(Schema.isMinLength(1))
      ),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .annotate({ description: "Nakafa Quran predecessor response." });

export type NakafaAgentQuranPredecessor = Schema.Schema.Type<
  typeof NakafaAgentQuranPredecessorSchema
>;
