import { Schema, Struct } from "effect";
export interface ParsedHeading {
  children: ParsedHeading[];
  href: string;
  index?: number;
  label: string;
}
const ParsedHeadingSchema = Schema.Struct({
  label: Schema.String,
  href: Schema.String,
  index: Schema.optional(Schema.Finite),
  children: Schema.Array(
    Schema.suspend((): Schema.Schema<ParsedHeading> => ParsedHeadingSchema)
  ).pipe(Schema.mutable),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
