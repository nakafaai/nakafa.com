import type { MathWorkResult } from "@repo/math/schema/work";
import { Context, Effect, Layer } from "effect";
import type { MathPersistenceError } from "./errors";

/** App-owned metadata attached to durable MathWork rows outside canonical evidence. */
export interface MathWorkPersistenceMetadata {
  readonly responseMessageIdentifier?: string;
  readonly toolCallId?: string;
}

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
