import {
  BatchIdSchema,
  ClientIdSchema,
  VersionSchema,
} from "@repo/backend/confect/editor/batch";
import { Option, Schema } from "effect";

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
 * The last batch one editor session had accepted, and the version that batch
 * produced. A client that was behind reads it to learn whether its in-flight batch
 * landed. It is null for a session that has had no batch accepted.
 */
const ClientRecordSchema = Schema.Struct({
  batch: BatchIdSchema,
  version: VersionSchema,
});

/** A session's record as a reader sees it: its batch and version, or null when the caller has none. */
export const ClientRecordView = Schema.NullOr(ClientRecordSchema);

/** The wire view of a session's record, or null when the caller has none. */
export const clientView = (
  record: Option.Option<typeof ClientRecordSchema.Type>
): typeof ClientRecordView.Type =>
  Option.match(record, {
    onNone: () => null,
    onSome: ({ batch, version }) => ({ batch, version }),
  });

/**
 * A document as its editor opens it: its snapshot as JSON text at one version, the
 * steps after that snapshot, and the session's own record. A long document takes more
 * than one read of its steps, so the editor reads on from the last version it received.
 */
export const OpenedDocument = Schema.Struct({
  client: ClientRecordView,
  snapshot: Schema.Struct({
    content: Schema.String,
    version: VersionSchema,
  }),
  steps: Schema.Array(StepView),
});

/**
 * The reply to a read of the steps after a version. `steps` carries the steps the log
 * still keeps after the version. `behind` says the log has pruned a step the client
 * needs, so the client opens again from the snapshot. Both carry the session's own
 * record, so a client that was behind learns whether its in-flight batch landed.
 */
export const SinceReply = Schema.Union([
  Schema.TaggedStruct("steps", {
    client: ClientRecordView,
    steps: Schema.Array(StepView),
  }),
  Schema.TaggedStruct("behind", {
    client: ClientRecordView,
  }),
]);
