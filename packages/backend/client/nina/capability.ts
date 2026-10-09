import { DataPartSchema } from "@repo/backend/confect/nina/contract/data";
import { Schema } from "effect";

/** Evidence cards keep their existing identities across progressive updates. */
export const CapabilityArtifactSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-math"),
    data: DataPartSchema.fields.math,
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-nakafa"),
    data: DataPartSchema.fields.nakafa,
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-scrape-url"),
    data: DataPartSchema.fields["scrape-url"],
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-web-search"),
    data: DataPartSchema.fields["web-search"],
  }),
]);

/** The final output owns every card; model context can project only its text. */
export const CapabilityOutputSchema = Schema.Struct({
  artifacts: Schema.Array(CapabilityArtifactSchema),
  failure: Schema.optionalKey(
    Schema.Literals(["failed", "denied", "sourceLimit"])
  ),
  text: Schema.String,
});
