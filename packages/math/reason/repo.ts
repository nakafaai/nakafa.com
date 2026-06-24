import type { MathWorkResult } from "@repo/math/schema/work";
import { Context, Effect, Layer, Schema } from "effect";
import type { MathPersistenceError } from "./errors";

/** App-owned metadata attached to durable MathWork rows outside canonical evidence. */
export const MathWorkPersistenceMetadataSchema = Schema.Struct({
  responseMessageIdentifier: Schema.optional(Schema.String),
  toolCallId: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

export type MathWorkPersistenceMetadata = Schema.Schema.Type<
  typeof MathWorkPersistenceMetadataSchema
>;

/** Durable persistence seam for normalized MathWork evidence. */
export class MathWorkRepository extends Context.Tag("MathWorkRepository")<
  MathWorkRepository,
  {
    /** Persist one complete MathWork result without storing raw chat transcript. */
    readonly save: (
      result: MathWorkResult,
      metadata: MathWorkPersistenceMetadata
    ) => Effect.Effect<void, MathPersistenceError>;
  }
>() {}

/** Test and local layer for MathReasoning calls that explicitly skip persistence. */
export const NoopMathWorkRepository = Layer.succeed(MathWorkRepository, {
  save: () => Effect.void,
});
