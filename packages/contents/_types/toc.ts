import { Schema } from "effect";

export interface ParsedHeading {
  children: ParsedHeading[];
  href: string;
  index?: number;
  label: string;
}

const ParsedHeadingSchema = Schema.Struct({
  label: Schema.String,
  href: Schema.String,
  index: Schema.optional(Schema.Number),
  children: Schema.Array(
    Schema.suspend((): Schema.Schema<ParsedHeading> => ParsedHeadingSchema)
  ).pipe(Schema.mutable),
}).pipe(Schema.mutable);
