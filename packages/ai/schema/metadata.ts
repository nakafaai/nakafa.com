import { CHAT_GENERATION_FAILURE_CODES } from "@repo/ai/config/generation";
import { ModelIdSchema } from "@repo/ai/config/model";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/ai/nina/context";
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
  generationErrorCode: Schema.optional(
    Schema.Literal(...CHAT_GENERATION_FAILURE_CODES)
  ),
  generationStatus: Schema.optional(Schema.Literal("complete", "failed")),
  model: ModelIdSchema,
  ninaContextSnapshot: Schema.optional(NinaContextSnapshotSchema),
  ninaContextTransition: Schema.optional(NinaContextTransitionSchema),
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
