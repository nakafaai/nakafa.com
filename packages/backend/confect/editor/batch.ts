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
const VersionSchema = Schema.Natural;
type Version = typeof VersionSchema.Type;

/**
 * The steps one call sends: the client that made them, the version they were
 * made on, and between one and `MAX_BATCH_STEPS` steps. A call with no step
 * moves nothing, so it is refused.
 */
export const BatchSchema = Schema.Struct({
  baseVersion: VersionSchema,
  clientId: Schema.String.check(Schema.isNonEmpty()),
  steps: Schema.NonEmptyArray(StepSchema).check(
    Schema.isMaxLength(MAX_BATCH_STEPS, {
      message: `Expected at most ${MAX_BATCH_STEPS} steps in one call.`,
    })
  ),
});
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
 * The batch names a version other than the document's current one. Its steps
 * were made on another version, so the client rebases them and sends again.
 */
export class StaleBatch extends Schema.TaggedError<StaleBatch>()("StaleBatch", {
  baseVersion: VersionSchema,
  version: VersionSchema,
}) {}

/**
 * Applies a batch on the version it names, and returns the version after its
 * steps. A batch applies only on the version it names, so any other version
 * refuses it as stale, and the version counts up by the number of steps.
 */
export const admitBatch = Effect.fn("editor.batch.admit")(function* (
  version: Version,
  batch: Batch
) {
  if (batch.baseVersion !== version) {
    return yield* new StaleBatch({ baseVersion: batch.baseVersion, version });
  }
  return version + batch.steps.length;
});

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
