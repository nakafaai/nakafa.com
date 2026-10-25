import { Schema, SchemaTransformation } from "effect";

/**
 * One query value as its text. TanStack reads a value that starts like JSON as
 * its JSON value, so `q=2024` arrives as the number 2024 and `q=false` as false.
 * The readers classify the text a visitor wrote, so a parsed scalar goes back to
 * that text. A value of any other shape, such as an array or an object, stays
 * that shape, and each reader decides what it means.
 */
export const QueryText = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]).pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      decode: (value) => (typeof value === "string" ? value : String(value)),
      encode: (text) => text,
    })
  )
);
