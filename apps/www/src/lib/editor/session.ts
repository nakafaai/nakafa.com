import type { VersionStale } from "@repo/backend/confect/editor/batch";
import type {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import type {
  ClientTaken,
  FoldPending,
} from "@repo/backend/confect/editor/errors";
import type {
  OpenedDocument,
  SinceReply,
} from "@repo/backend/confect/editor/view";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { type Effect, type Ref, Schema, type Semaphore } from "effect";

/** A call to the server that failed for a reason the loop does not decide: the network, a denied access, or a refused read. */
export class SyncFailed extends Schema.TaggedError<SyncFailed>()("SyncFailed", {
  reason: Schema.String,
}) {}

/**
 * The server is folding this document's steps into its snapshot, so it takes no batch for
 * a moment (ADR 0028). The batch stays unsent under its id, and the round runs again after a
 * short wait. A round that still meets the fold when its waits end fails with it, and
 * `tickThroughFold` runs the round again on the cadence of `FOLD_RETRY`.
 */
export class SyncFolding extends Schema.TaggedError<SyncFolding>()(
  "SyncFolding",
  {}
) {}

/**
 * A step that does not apply to a document: ProseMirror refused it, it threw while
 * it applied the step, such as a position outside the document, or the document it
 * makes nests past the bound of the contract. The reason is the text ProseMirror gave,
 * or the bound it passes. The loop skips or drops the step, and logs the reason.
 */
export class StepRejected extends Schema.TaggedError<StepRejected>()(
  "StepRejected",
  {
    reason: Schema.String,
  }
) {}

/**
 * Steps of this editor that the document no longer takes: another editor changed the
 * same text while this one was away, the server skipped one of its steps because it
 * nests the document past the bound, or one step no call can carry, because it is
 * larger than a call may send or the contract refuses it. The loop reports the count
 * once, from the first round that completes after the change, so the editor can tell
 * its user once.
 */
export class SyncDropped extends Schema.TaggedClass<SyncDropped>()(
  "SyncDropped",
  {
    count: Schema.Natural,
  }
) {}

/**
 * The editor closed while the loop worked on it, so its view takes no more changes. A change
 * to a closed editor is neither applied nor stale, so the port fails with this error, and the
 * loop stops there.
 */
export class EditorClosed extends Schema.TaggedError<EditorClosed>()(
  "EditorClosed",
  {}
) {}

/** The server calls the loop makes. Each one wraps a Convex function, and maps the failures the loop does not decide to `SyncFailed`. */
export interface SyncTransport {
  readonly open: (
    clientId: string
  ) => Effect.Effect<typeof OpenedDocument.Type, SyncFailed>;
  readonly since: (
    clientId: string,
    version: number
  ) => Effect.Effect<typeof SinceReply.Type, SyncFailed>;
  readonly submit: (
    batch: string
  ) => Effect.Effect<
    null,
    | SyncFailed
    | VersionStale
    | ClientTaken
    | DocumentInvalid
    | DocumentTooLarge
    | FoldPending
  >;
}

/**
 * The editor the loop reads and changes. The caller builds it over a Tiptap editor, or
 * over a plain state in a test. The loop never changes the editor's state in two steps:
 * it reads the state, builds the change from that state, and writes the change only
 * when the editor still holds the state it was built from. An edit that landed in
 * between is not lost; the loop reads again and builds the change anew.
 */
export interface EditorPort {
  /** Applies the transaction when the editor still holds `from`, which the transaction was built from. Says whether it applied, and fails with `EditorClosed` once the editor is closed. */
  readonly dispatch: (
    from: EditorState,
    transaction: Transaction
  ) => Effect.Effect<boolean, EditorClosed>;
  /** A state of the editor for this document at this version under this client ID, with the editor's own plugins. */
  readonly fresh: (input: {
    readonly clientId: string;
    readonly doc: Node;
    readonly version: number;
  }) => EditorState;
  /** Replaces the editor's state with `next` when the editor still holds `from`. Says whether it replaced it, and fails with `EditorClosed` once the editor is closed. */
  readonly replace: (
    from: EditorState,
    next: EditorState
  ) => Effect.Effect<boolean, EditorClosed>;
  readonly schema: ProseSchema;
  /** The state the editor holds now. A state is immutable, so a read keeps the state it returned. */
  readonly state: Effect.Effect<EditorState>;
}

/**
 * The batch this editor made last: its id, how many of its unconfirmed steps it
 * holds, and the version it was made on. `sent` is true once a call reached the
 * server and the answer is awaited, so the next round waits for the server's steps
 * instead of sending it again. A batch whose call failed keeps its id, and the next
 * round sends the same batch, so the server can answer a repeat of a batch it took.
 */
const PendingBatch = Schema.Struct({
  count: Schema.Natural,
  id: Schema.String,
  sent: Schema.Boolean,
  version: Schema.Natural,
});

/**
 * What the loop remembers between rounds. `batch` is the batch in flight, refused,
 * or failed. `dropped` counts the steps this editor lost while it opened again, which
 * no round has reported yet.
 */
export const Memory = Schema.Struct({
  batch: Schema.Option(PendingBatch),
  clientId: Schema.String,
  dropped: Schema.Natural,
});

/**
 * One editor's sync with one document: its port, its transport, what it remembers,
 * and its rounds. `server` is the document at the server's version: the loop applies
 * the server's steps to it first, so every editor decides the same way whether a
 * stored step applies, and the editor's own unconfirmed steps stay out of it. A
 * round reads the version, waits for the server, and then applies the reply, so two
 * rounds at once would apply one reply twice. The `rounds` lock lets one round run
 * at a time.
 */
export interface SyncSession {
  readonly memory: Ref.Ref<typeof Memory.Type>;
  readonly port: EditorPort;
  readonly rounds: Semaphore.Semaphore;
  readonly server: Ref.Ref<Node>;
  readonly transport: SyncTransport;
}
