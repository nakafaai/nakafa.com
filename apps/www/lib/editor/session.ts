import type { VersionStale } from "@repo/backend/confect/editor/batch";
import type {
  ClientTaken,
  SnapshotRefused,
} from "@repo/backend/confect/editor/errors";
import type {
  OpenedDocument,
  SinceReply,
} from "@repo/backend/confect/editor/view";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  Clock,
  DateTime,
  Effect,
  type Ref,
  Schema,
  type Semaphore,
} from "effect";

/** A call to the server that failed for a reason the loop does not decide: the network, a denied access, or a refused read. */
export class SyncFailed extends Schema.TaggedError<SyncFailed>()("SyncFailed", {
  reason: Schema.String,
}) {}

/**
 * Steps of this editor that the document no longer takes, because another editor
 * changed the same text while this one was away. The loop reports the count once,
 * when it opens the document again from its snapshot, so the editor can tell its
 * user once.
 */
export class SyncDropped extends Schema.TaggedClass<SyncDropped>()(
  "SyncDropped",
  {
    count: Schema.Natural,
  }
) {}

/** The server calls the loop makes. Each one wraps a Convex function, and maps the failures the loop does not decide to `SyncFailed`. */
export interface SyncTransport {
  readonly open: (
    clientId: string
  ) => Effect.Effect<typeof OpenedDocument.Type, SyncFailed>;
  readonly save: (snapshot: {
    readonly content: string;
    readonly version: number;
  }) => Effect.Effect<
    { readonly version: number },
    SyncFailed | SnapshotRefused
  >;
  readonly since: (
    clientId: string,
    version: number
  ) => Effect.Effect<typeof SinceReply.Type, SyncFailed>;
  readonly submit: (
    batch: string
  ) => Effect.Effect<
    { readonly head: number },
    SyncFailed | VersionStale | ClientTaken
  >;
}

/** The editor the loop reads and changes. The caller builds it over a Tiptap editor, or over a plain state in a test. */
export interface EditorPort {
  readonly dispatch: (transaction: Transaction) => Effect.Effect<void>;
  /** Replaces the document with a fresh state at this version, under this client ID. */
  readonly replace: (input: {
    readonly clientId: string;
    readonly doc: Node;
    readonly version: number;
  }) => Effect.Effect<void>;
  readonly schema: ProseSchema;
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
 * or failed. `lastChangeAt` is the last time an edit of this document was seen, from
 * this editor or another, and the snapshot rule reads it as the idle time.
 */
export const Memory = Schema.Struct({
  batch: Schema.Option(PendingBatch),
  clientId: Schema.String,
  head: Schema.Natural,
  lastChangeAt: Schema.DateTimeUtc,
  snapshotAt: Schema.Option(Schema.DateTimeUtc),
  snapshotVersion: Schema.Natural,
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

/** The current time as a `DateTime`, read from the clock so a test can move it. */
export const nowTime = Effect.map(Clock.currentTimeMillis, DateTime.makeUnsafe);
