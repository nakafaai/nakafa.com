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

/**
 * How a capability run fell short. `partial` kept evidence although a part of
 * the run failed, `empty` ran and found nothing, `limit` exceeded a stated
 * limit, `denied` was refused by policy, and `failed` left nothing usable.
 */
export const CapabilityOutcomeSchema = Schema.Literals([
  "partial",
  "empty",
  "limit",
  "denied",
  "failed",
]);

/**
 * The final output owns every card; model context can project only its text.
 * An output without an outcome ran to its end with its evidence.
 */
export const CapabilityOutputSchema = Schema.Struct({
  artifacts: Schema.Array(CapabilityArtifactSchema),
  outcome: Schema.optionalKey(CapabilityOutcomeSchema),
  text: Schema.String,
});
