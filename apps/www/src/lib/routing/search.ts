import { Schema, SchemaTransformation } from "effect";

/**
 * One query value as its text. TanStack reads a value that starts like JSON as
 * its JSON value, so `q=2024` arrives as the number 2024 and `q=false` as false.
 * A parsed scalar reads back as its canonical text, so a numeral that is not
 * canonical, such as `1.50`, reads as `1.5`. The router quotes text that reads as
 * JSON when it writes the address, so the text a visitor types reads back
 * unchanged, and the address shows it quoted, as `q=%222024%22`. A value of any
 * other shape, such as an array or an object, stays that shape, and each reader
 * decides what it means.
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
