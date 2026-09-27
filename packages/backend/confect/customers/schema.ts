import { Schema } from "effect";
/**
 * Polar metadata validator.
 * Polar stores flat primitive metadata values.
 */
export const polarMetadataValidator = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
);
