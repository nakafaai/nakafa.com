import {
  ClientIdSchema,
  VersionSchema,
} from "@repo/backend/confect/editor/batch";
import { Schema } from "effect";

/**
 * One step as the wire shows it: its version, the client that made it, and its
 * JSON text. The author stays on the server, because a co-editor needs the client
 * to rebase its own steps and does not need the account behind a step.
 */
export const StepView = Schema.Struct({
  clientId: ClientIdSchema,
  step: Schema.String,
  version: VersionSchema,
});

/** A stored step, read as its wire view. */
export const stepView = (row: typeof StepView.Type) => ({
  clientId: row.clientId,
  step: row.step,
  version: row.version,
});

/**
 * A document as its editor opens it: its head, its snapshot as JSON text at one
 * version, and the steps after that snapshot. A long document takes more than one
 * read of its steps, so the editor reads on from the last version it received.
 */
export const OpenedDocument = Schema.Struct({
  head: VersionSchema,
  snapshot: Schema.Struct({
    content: Schema.String,
    version: VersionSchema,
  }),
  steps: Schema.Array(StepView),
});

/**
 * The reply to a read of the steps after a version. `steps` carries the head and
 * the steps the log still keeps after the version. `behind` carries the head when
 * the log has pruned a step the client needs, so the client opens from the snapshot.
 */
export const SinceReply = Schema.Union([
  Schema.TaggedStruct("steps", {
    head: VersionSchema,
    steps: Schema.Array(StepView),
  }),
  Schema.TaggedStruct("behind", {
    head: VersionSchema,
  }),
]);
