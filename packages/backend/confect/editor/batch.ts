import {
  MAX_BATCH_BYTES,
  MAX_BATCH_STEPS,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import {
  StepSchema,
  UncheckedStepSchema,
} from "@repo/backend/confect/editor/step";
import { Effect, Schema } from "effect";

/**
 * The version of a document: the number of steps applied to it. A new document
 * is at version 0, and each batch moves it up by the number of its steps.
 */
export const VersionSchema = Schema.Natural;
type Version = typeof VersionSchema.Type;

/**
 * Most characters in a client or batch id. A v4 UUID from `randomUuid`
 * (`@repo/utilities/uuid`) has 36, so 64 leaves room for a prefix. Each stored
 * step keeps its client id, so the bound also caps that id in every stored row.
 * It is a target (ADR 0028 Bounds), not a Convex limit.
 */
export const MAX_ID_LENGTH = 64;

/**
 * The id of the editor session that made a batch. A client keeps its own id, so
 * it can tell its steps from the others' when the server returns them, and every
 * stored step keeps the id.
 */
export const ClientIdSchema = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_ID_LENGTH, {
    message: `Expected a client id of at most ${MAX_ID_LENGTH} characters.`,
  })
);

/**
 * The id of one batch, which the client makes with `randomUuid` for each batch
 * and keeps when it sends the batch again. The server answers a repeat of an
 * accepted batch with its version, and writes nothing (ADR 0028).
 */
export const BatchIdSchema = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_ID_LENGTH, {
    message: `Expected a batch id of at most ${MAX_ID_LENGTH} characters.`,
  })
);

/**
 * The steps one call sends: the batch and the client that made them, the version
 * they were made on, and between one and `MAX_BATCH_STEPS` steps. A call with no
 * step moves nothing, so it is refused.
 */
export const BatchSchema = Schema.Struct({
  baseVersion: VersionSchema,
  batch: BatchIdSchema,
  clientId: ClientIdSchema,
  steps: Schema.NonEmptyArray(StepSchema).check(
    Schema.isMaxLength(MAX_BATCH_STEPS, {
      message: `Expected at most ${MAX_BATCH_STEPS} steps in one call.`,
    })
  ),
});
/** One call's batch of steps, as `BatchSchema` decodes it. */
export type Batch = typeof BatchSchema.Type;

/** A call whose batch is larger than one call may send. */
export class BatchTooLarge extends Schema.TaggedError<BatchTooLarge>()(
  "BatchTooLarge",
  {
    bytes: Schema.Int,
    limit: Schema.Int,
  }
) {}

/**
 * The batch names a version other than the document's head. Its steps were made
 * on another version, so the client waits for the steps it is missing, rebases
 * its own, and sends again. The head is the version the document is at now.
 */
export class VersionStale extends Schema.TaggedError<VersionStale>()(
  "VersionStale",
  {
    baseVersion: VersionSchema,
    head: VersionSchema,
  }
) {}

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
 * Checks that a decoded batch names the document's head, and returns the batch
 * with the version after its steps. A batch applies only on the version it names,
 * so any other version refuses it with `VersionStale`. It applies nothing: the
 * caller writes the steps it gets back, and the version counts up by the number
 * of steps.
 */
export const admitBatch = Effect.fn("editor.batch.admit")(function* (
  head: Version,
  batch: Batch
) {
  if (batch.baseVersion !== head) {
    return yield* new VersionStale({ baseVersion: batch.baseVersion, head });
  }
  return { batch, version: head + batch.steps.length };
});
