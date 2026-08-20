import { CHAT_GENERATION_FAILURE_CODES } from "@repo/ai/config/generation";
import { ModelIdSchema } from "@repo/ai/config/model";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/ai/nina/memory/pack";
import { Schema, Struct } from "effect";

const ComponentUsageSchema = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/**
 * Metadata stored on Nina UI messages.
 */
export const MetadataSchema = Schema.Struct({
  credits: Schema.optional(Schema.Finite),
  generationErrorCode: Schema.optional(
    Schema.Literals(CHAT_GENERATION_FAILURE_CODES)
  ),
  generationStatus: Schema.optional(Schema.Literals(["complete", "failed"])),
  model: ModelIdSchema,
  ninaContextSnapshot: Schema.optional(NinaContextSnapshotSchema),
  ninaContextTransition: Schema.optional(NinaContextTransitionSchema),
  tokens: Schema.optional(
    Schema.Struct({
      breakdown: Schema.optional(
        Schema.Struct({
          main: ComponentUsageSchema,
          subAgents: Schema.Record(Schema.String, ComponentUsageSchema),
        }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
      ),
      input: Schema.optional(Schema.Finite),
      output: Schema.optional(Schema.Finite),
      total: Schema.optional(Schema.Finite),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ComponentUsage = Schema.Schema.Type<typeof ComponentUsageSchema>;
export type Metadata = Schema.Schema.Type<typeof MetadataSchema>;
