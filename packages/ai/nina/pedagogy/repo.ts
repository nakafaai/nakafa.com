import type { PedagogyProjectionShape } from "@repo/ai/nina/pedagogy/schema";
import { Effect, Schema } from "effect";

/** Raised when a non-canonical pedagogy projection cannot be persisted. */
export class PedagogyProjectionPersistenceError extends Schema.TaggedError<PedagogyProjectionPersistenceError>()(
  "PedagogyProjectionPersistenceError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/** Durable metadata that ties a projection to one streamed assistant response. */
export const PedagogyProjectionPersistenceMetadataSchema = Schema.Struct({
  responseMessageIdentifier: Schema.optional(Schema.String),
  toolCallId: Schema.optional(Schema.String),
}).pipe(Schema.mutable);

export type PedagogyProjectionPersistenceMetadata = Schema.Schema.Type<
  typeof PedagogyProjectionPersistenceMetadataSchema
>;

const noOpRepository = {
  /** Keeps package tests and non-production callers from persisting projections. */
  save: saveNoopProjection,
};

/** Accepts projection persistence without IO for tests and non-production callers. */
function saveNoopProjection(
  _projection: PedagogyProjectionShape,
  _metadata: PedagogyProjectionPersistenceMetadata
): Effect.Effect<void, PedagogyProjectionPersistenceError> {
  return Effect.void;
}

/** Repository Adapter seam for non-canonical pedagogy projection persistence. */
export class PedagogyProjectionRepository extends Effect.Service<PedagogyProjectionRepository>()(
  "@repo/ai/PedagogyProjectionRepository",
  {
    accessors: true,
    succeed: noOpRepository,
  }
) {}
