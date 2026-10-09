import { Schema, Struct } from "effect";

/** Runtime contract for one external source reference extracted from user text. */
export const SourceReferenceSchema = Schema.Struct({
  href: Schema.String,
  hostname: Schema.String,
  text: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
