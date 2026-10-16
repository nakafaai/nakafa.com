import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ClientIdSchema } from "@repo/backend/confect/editor/batch";
import {
  StepTextSchema,
  UncheckedStepSchema,
} from "@repo/backend/confect/editor/step";
import { Effect, Schema } from "effect";

/**
 * One step as the step log keeps it: the account that sent it (ADR 0028), the
 * client that made it, and the step's JSON text in one string field. The step is
 * text for the reason a document is: a nested Convex object cannot hold a slice
 * this deep.
 */
export const StoredStepSchema = Schema.Struct({
  author: IdSchema("users"),
  clientId: ClientIdSchema,
  step: StepTextSchema,
});
type StoredStep = typeof StoredStepSchema.Type;

/**
 * Writes a stored step as the row the step log keeps. The depth of its slice is
 * checked on the typed step before the encoder walks it, as `encodeStep` does.
 */
export const encodeStoredStep = Effect.fn("editor.log.encode")(function* (
  stored: StoredStep
) {
  yield* Schema.decodeEffect(UncheckedStepSchema)(stored.step);
  return yield* Schema.encodeEffect(StoredStepSchema)(stored);
});

/** Reads a stored row back into a checked stored step. */
export const decodeStoredStep = Effect.fn("editor.log.decode")(function* (
  row: unknown
) {
  return yield* Schema.decodeUnknownEffect(StoredStepSchema)(row);
});
