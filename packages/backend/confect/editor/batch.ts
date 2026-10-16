import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_STEPS,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import {
  StepSchema,
  StepTextSchema,
  UncheckedStepSchema,
} from "@repo/backend/confect/editor/step";
import { Effect, Schema } from "effect";

/**
 * The version of a document: the number of steps applied to it. A new document
 * is at version 0, and each batch moves it up by the number of its steps.
 */
const VersionSchema = Schema.Natural;
type Version = typeof VersionSchema.Type;

/**
 * Most characters in a client id. A v4 UUID from `randomUuid` (`@repo/utilities/uuid`)
 * has 36, so 64 leaves room for a prefix. Each stored step keeps its client id, so
 * the bound also caps that id in every stored row. It is a target (ADR 0028
 * Bounds), not a Convex limit.
 */
export const MAX_CLIENT_ID_LENGTH = 64;

/**
 * The id of the editor instance that made a batch. A client keeps its own id, so
 * it can tell its steps from the others' when the server returns them, and every
 * stored step keeps the id.
 */
const ClientIdSchema = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_CLIENT_ID_LENGTH, {
    message: `Expected a client id of at most ${MAX_CLIENT_ID_LENGTH} characters.`,
  })
);

/**
 * The steps one call sends: the client that made them, the version they were
 * made on, and between one and `MAX_BATCH_STEPS` steps. A call with no step
 * moves nothing, so it is refused.
 */
export const BatchSchema = Schema.Struct({
  baseVersion: VersionSchema,
  clientId: ClientIdSchema,
  steps: Schema.NonEmptyArray(StepSchema).check(
    Schema.isMaxLength(MAX_BATCH_STEPS, {
      message: `Expected at most ${MAX_BATCH_STEPS} steps in one call.`,
    })
  ),
});
export type Batch = typeof BatchSchema.Type;

/**
 * One step as the step log keeps it: the account that sent it (ADR 0028), the
 * client that made it, and the step's JSON text in one string field. The step is
 * text for the reason a document is: a nested Convex object cannot hold a slice
 * this deep.
 */
const StoredStepSchema = Schema.Struct({
  author: IdSchema("users"),
  clientId: ClientIdSchema,
  step: StepTextSchema,
});
type StoredStep = typeof StoredStepSchema.Type;

/** A call whose batch is larger than one call may send. */
export class BatchTooLarge extends Schema.TaggedError<BatchTooLarge>()(
  "BatchTooLarge",
  {
    bytes: Schema.Int,
    limit: Schema.Int,
  }
) {}

/**
 * The batch names a version other than the document's current one. Its steps
 * were made on another version, so the client rebases them and sends again.
 */
export class StaleBatch extends Schema.TaggedError<StaleBatch>()("StaleBatch", {
  baseVersion: VersionSchema,
  version: VersionSchema,
}) {}

/** The JSON text of a batch: the call's body, which a client writes and the server reads. */
const BatchTextSchema = Schema.fromJsonString(BatchSchema);

/**
 * Refuses a batch text over `MAX_BATCH_BYTES`, with the bytes it takes and the
 * limit. It runs before a client sends a call, and before the server parses one.
 */
const ensureBatchBytes = Effect.fn("editor.batch.bytes")(function* (
  text: string
) {
  const bytes = utf8Bytes(text);
  if (bytes > MAX_BATCH_BYTES) {
    return yield* new BatchTooLarge({ bytes, limit: MAX_BATCH_BYTES });
  }
});

/**
 * Writes a batch as the JSON text a client sends. The depth of each step's slice
 * is checked on the typed input before the encoder walks it, and a text over
 * `MAX_BATCH_BYTES` is refused before the call is sent.
 */
export const encodeBatch = Effect.fn("editor.batch.encode")(function* (
  batch: Batch
) {
  yield* Schema.decodeEffect(Schema.Array(UncheckedStepSchema))(batch.steps);
  const text = yield* Schema.encodeEffect(BatchTextSchema)(batch);
  yield* ensureBatchBytes(text);
  return text;
});

/**
 * Reads a batch from the JSON text of one call. The text is measured before it
 * is parsed, so a call over `MAX_BATCH_BYTES` is refused unread. A key that the
 * batch does not declare is refused, not dropped, so the call that the bound
 * measures is the call that is read.
 */
export const decodeBatch = Effect.fn("editor.batch.decode")(function* (
  text: string
) {
  yield* ensureBatchBytes(text);
  return yield* Schema.decodeEffect(BatchTextSchema)(text, {
    onExcessProperty: "error",
  });
});

/**
 * Checks a call that sends a batch, and returns the batch with the version after
 * its steps. `decodeBatch` reads the call's text and checks its bytes and the
 * bounds of the batch. The batch must then name the document's version: a batch
 * applies only on the version it names, so any other version refuses it as stale.
 * It applies nothing. The caller stores the steps it gets back, and the version
 * counts up by the number of steps.
 */
export const admitBatch = Effect.fn("editor.batch.admit")(function* (
  version: Version,
  text: string
) {
  const batch = yield* decodeBatch(text);
  if (batch.baseVersion !== version) {
    return yield* new StaleBatch({ baseVersion: batch.baseVersion, version });
  }
  return { batch, version: version + batch.steps.length };
});

/**
 * Writes a stored step as the row the step log keeps. The depth of its slice is
 * checked on the typed step before the encoder walks it, as `encodeStep` does.
 */
export const encodeStoredStep = Effect.fn("editor.batch.storedStep.encode")(
  function* (stored: StoredStep) {
    yield* Schema.decodeEffect(UncheckedStepSchema)(stored.step);
    return yield* Schema.encodeEffect(StoredStepSchema)(stored);
  }
);

/** Reads a stored row back into a checked stored step. */
export const decodeStoredStep = Effect.fn("editor.batch.storedStep.decode")(
  function* (row: unknown) {
    return yield* Schema.decodeUnknownEffect(StoredStepSchema)(row);
  }
);
