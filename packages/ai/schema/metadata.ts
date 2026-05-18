import { MODEL_IDS } from "@repo/ai/config/models";
import { Schema } from "effect";

const ComponentUsageSchema = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
}).pipe(Schema.mutable);

/**
 * Metadata stored on Nina UI messages.
 */
export const MetadataSchema = Schema.Struct({
  credits: Schema.optional(Schema.Number),
  model: Schema.Literal(...MODEL_IDS),
  tokens: Schema.optional(
    Schema.Struct({
      breakdown: Schema.optional(
        Schema.Struct({
          main: ComponentUsageSchema,
          subAgents: Schema.Record({
            key: Schema.String,
            value: ComponentUsageSchema,
          }).pipe(Schema.mutable),
        }).pipe(Schema.mutable)
      ),
      input: Schema.optional(Schema.Number),
      output: Schema.optional(Schema.Number),
      total: Schema.optional(Schema.Number),
    }).pipe(Schema.mutable)
  ),
}).pipe(Schema.mutable);

export type ComponentUsage = Schema.Schema.Type<typeof ComponentUsageSchema>;
export type Metadata = Schema.Schema.Type<typeof MetadataSchema>;
